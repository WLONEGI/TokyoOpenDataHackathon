import axios from 'axios';
import { OpenDataItem, DataSource, SupportedLanguage, OpenDataCategory } from '@/types';
import { log } from '@/lib/logger';
import { GeminiService } from './GeminiService';
import { safeJsonParse } from '@/lib/utils/jsonParser';

interface CKANDataset {
  id: string;
  name: string;
  title: string;
  notes: string;
  tags: Array<{ name: string; vocabulary_id?: string }>;
  groups: Array<{ name: string; title: string }>;
  organization: {
    name: string;
    title: string;
  };
  resources: Array<{
    id: string;
    url: string;
    format: string;
    name: string;
    description: string;
    created: string;
    last_modified: string;
  }>;
  metadata_created: string;
  metadata_modified: string;
  license_title?: string;
}

interface DatasetSummary {
  index: number;
  id: string;
  title: string;
  description: string;
  tags: string;
  organization: string;
}

interface CKANSearchResponse {
  success: boolean;
  result: {
    count: number;
    results: CKANDataset[];
    facets?: any;
  };
}

export class TokyoOpenDataService {
  private catalogBaseUrl = 'https://catalog.data.metro.tokyo.lg.jp';
  private apiBaseUrl = 'https://catalog.data.metro.tokyo.lg.jp/api/3';
  private geminiService: GeminiService;
  private datasetCache = new Map<string, CKANDataset[]>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30分

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * ユーザーの質問に基づいて関連するオープンデータを動的に検索・取得
   */
  async fetchRelevantData(query: string, language: SupportedLanguage = 'ja'): Promise<OpenDataItem[]> {
    try {
      log.info('Starting dynamic open data search', { 
        query: query.substring(0, 100),
        language 
      });

      // 1. AIを使って検索キーワードとカテゴリを抽出
      const searchParams = await this.extractSearchParameters(query, language);
      log.debug('Extracted search parameters', searchParams);

      // 2. CKAN APIでデータセットを検索
      const datasets = await this.searchDatasets(searchParams);
      log.info('Found datasets', { count: datasets.length });

      if (datasets.length === 0) {
        return this.getFallbackData(query, language);
      }

      // 3. 関連度でソートして上位データセットを選択
      const relevantDatasets = await this.rankDatasetsByRelevance(datasets, query, language);
      const topDatasets = relevantDatasets.slice(0, 5); // 上位5データセット

      // 4. 選択されたデータセットからデータを並列取得・変換
      const datasetPromises = topDatasets.map(async (dataset) => {
        try {
          return await this.processDataset(dataset, query, language);
        } catch (error) {
          log.warn('Failed to process dataset', {
            datasetId: dataset.id,
            error: (error as Error).message
          });
          return [];
        }
      });

      const datasetResults = await Promise.allSettled(datasetPromises);
      const allItems: OpenDataItem[] = [];
      
      for (const result of datasetResults) {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value);
        }
      }

      log.info('Successfully processed open data', { 
        totalItems: allItems.length,
        datasetsProcessed: topDatasets.length 
      });

      return allItems;

    } catch (error) {
      log.error('Error in dynamic open data search', error as Error, { query });
      return this.getFallbackData(query, language);
    }
  }

  /**
   * AIを使ってユーザーの質問から検索パラメータを抽出
   */
  private async extractSearchParameters(query: string, language: SupportedLanguage): Promise<{
    keywords: string[];
    categories: string[];
    organizations: string[];
    tags: string[];
  }> {
    try {
      const prompt = this.buildSearchExtractionPrompt(query, language);
      const response = await this.geminiService.generateText(prompt, undefined, language);
      
      // 安全なJSON解析
      const parsed = safeJsonParse(response, {
        keywords: this.extractKeywordsBasic(query),
        categories: [],
        organizations: [],
        tags: []
      });
      
      return {
        keywords: parsed.keywords || [],
        categories: parsed.categories || [],
        organizations: parsed.organizations || [],
        tags: parsed.tags || []
      };
    } catch (error) {
      log.warn('Failed to extract search parameters with AI', {
        error: (error as Error).message,
        fallback: 'basic-keyword-extraction'
      });
      
      return {
        keywords: this.extractKeywordsBasic(query),
        categories: [],
        organizations: [],
        tags: []
      };
    }
  }

  private buildSearchExtractionPrompt(query: string, language: SupportedLanguage): string {
    const prompts = {
      ja: `
以下のユーザーの質問から、東京都オープンデータを検索するためのパラメータを抽出してください。

ユーザーの質問: "${query}"

【抽出する情報】
1. キーワード: 質問に含まれる重要な単語（名詞、動詞など）
2. カテゴリ: 関連する行政分野（例：子育て、教育、福祉、環境、交通、防災、経済、観光等）
3. 組織: 関連する東京都の組織（例：都庁、区市町村等）
4. タグ: データに付与されそうなタグ

【出力形式】
以下のJSON形式で出力してください：
{
  "keywords": ["キーワード1", "キーワード2"],
  "categories": ["カテゴリ1"],
  "organizations": ["組織1"],
  "tags": ["タグ1", "タグ2"]
}`,
      en: `
Extract search parameters for Tokyo Open Data from the following user question.

User question: "${query}"

Extract:
1. Keywords: Important words (nouns, verbs, etc.)
2. Categories: Related administrative fields (childcare, education, welfare, environment, transportation, disaster prevention, economy, tourism, etc.)
3. Organizations: Related Tokyo organizations
4. Tags: Likely data tags

Output in JSON format:
{
  "keywords": ["keyword1", "keyword2"],
  "categories": ["category1"],
  "organizations": ["org1"],
  "tags": ["tag1", "tag2"]
}`
    };

    return prompts[language as keyof typeof prompts] || prompts.ja;
  }

  /**
   * 基本的なキーワード抽出（AI失敗時のフォールバック）
   */
  private extractKeywordsBasic(query: string): string[] {
    // 簡単な形態素解析もどき
    const keywords = query
      .replace(/[？?！!。、，,．.]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)
      .filter(word => !['について', 'に関して', 'を教えて', 'ください', 'です', 'ます', 'である'].includes(word));
    
    return [...new Set(keywords)]; // 重複除去
  }

  /**
   * CKAN APIを使用してデータセットを検索
   */
  private async searchDatasets(searchParams: {
    keywords: string[];
    categories: string[];
    organizations: string[];
    tags: string[];
  }): Promise<CKANDataset[]> {
    const cacheKey = JSON.stringify(searchParams);
    
    // キャッシュチェック
    if (this.datasetCache.has(cacheKey) && 
        this.cacheExpiry.get(cacheKey)! > Date.now()) {
      log.debug('Using cached dataset search results');
      return this.datasetCache.get(cacheKey)!;
    }

    try {
      // CKANのpackage_search APIを使用
      const searchQuery = this.buildCKANQuery(searchParams);
      const url = `${this.apiBaseUrl}/action/package_search`;
      
      const response = await axios.get<CKANSearchResponse>(url, {
        params: {
          q: searchQuery,
          rows: 50, // 最大50件
          start: 0,
          sort: 'score desc, metadata_modified desc'
        },
        timeout: 10000, // Reduced timeout for better performance
        headers: {
          'User-Agent': 'Tokyo-AI-Assistant/1.0'
        },
        // Add caching and performance optimizations
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      if (response.data.success && response.data.result.results) {
        const datasets = response.data.result.results;
        
        // キャッシュに保存
        this.datasetCache.set(cacheKey, datasets);
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);
        
        log.info('CKAN search completed', { 
          query: searchQuery,
          totalCount: response.data.result.count,
          returnedCount: datasets.length 
        });
        
        return datasets;
      } else {
        throw new Error('CKAN API returned unsuccessful response');
      }
    } catch (error) {
      log.error('CKAN dataset search failed', error as Error, { searchParams });
      return [];
    }
  }

  private buildCKANQuery(searchParams: {
    keywords: string[];
    categories: string[];
    organizations: string[];
    tags: string[];
  }): string {
    // カテゴリフィルタのみを使用
    if (searchParams.categories.length > 0) {
      return `groups:(${searchParams.categories.join(' OR ')})`;
    }

    // カテゴリが指定されていない場合は全データセットを対象
    return '*:*';
  }

  /**
   * AIを使ってデータセットの関連度をランキング
   */
  private async rankDatasetsByRelevance(
    datasets: CKANDataset[], 
    query: string, 
    language: SupportedLanguage
  ): Promise<CKANDataset[]> {
    // For performance, limit AI ranking to top 20 datasets
    const datasetsToRank = datasets.slice(0, 20);
    
    try {
      // データセットの情報を簡潔にまとめてAIに送信
      const datasetSummaries = datasetsToRank.map((dataset, index) => ({
        index,
        id: dataset.id,
        title: dataset.title,
        description: dataset.notes?.substring(0, 200) || '',
        tags: dataset.tags.map(tag => tag.name).join(', '),
        organization: dataset.organization?.title || ''
      }));

      // Use Promise.race with timeout for better performance
      const rankingPromise = this.performAIRanking(query, datasetSummaries, language);
      const timeoutPromise = new Promise<CKANDataset[]>((_, reject) => 
        setTimeout(() => reject(new Error('AI ranking timeout')), 5000)
      );

      const rankedDatasets = await Promise.race([rankingPromise, timeoutPromise]);
      
      // Append remaining datasets that weren't ranked
      const remainingDatasets = datasets.slice(20);
      return [...rankedDatasets, ...remainingDatasets];
      
    } catch (error) {
      log.warn('Failed to rank datasets with AI', { 
        error: (error as Error).message 
      });
      
      // AI失敗時は元の順序を保持
      return datasets;
    }
  }

  private async performAIRanking(
    query: string, 
    datasetSummaries: DatasetSummary[], 
    language: SupportedLanguage
  ): Promise<CKANDataset[]> {
    const prompt = this.buildRankingPrompt(query, datasetSummaries, language);
    const response = await this.geminiService.generateText(prompt, undefined, language);
    
    // 安全なJSON解析
    const ranking = safeJsonParse(response, []) as Array<{index: number; score: number; reason: string}>;
    
    if (Array.isArray(ranking) && ranking.length > 0) {
      // ランキングに基づいてデータセットを並び替え
      const rankedDatasets = ranking
        .filter(item => typeof item.index === 'number' && item.index < datasetSummaries.length)
        .map(item => datasetSummaries[item.index]);
      
      return rankedDatasets;
    }
    
    return datasetSummaries;
  }

  private buildRankingPrompt(
    query: string, 
    datasetSummaries: DatasetSummary[], 
    language: SupportedLanguage
  ): string {
    const prompts = {
      ja: `
ユーザーの質問: "${query}"

以下のデータセットの中から、ユーザーの質問に最も関連性の高いものから順番に並べ替えてください。

データセット一覧:
${datasetSummaries.map((dataset, i) => 
  `${i}. ${dataset.title}\n説明: ${dataset.description}\nタグ: ${dataset.tags}\n組織: ${dataset.organization}`
).join('\n\n')}

関連度の高い順に並べて、以下のJSON形式で出力してください：
[
  {"index": 0, "score": 0.9, "reason": "理由"},
  {"index": 2, "score": 0.8, "reason": "理由"}
]`,
      en: `
User question: "${query}"

Rank the following datasets by relevance to the user's question:

Datasets:
${datasetSummaries.map((dataset, i) => 
  `${i}. ${dataset.title}\nDescription: ${dataset.description}\nTags: ${dataset.tags}\nOrganization: ${dataset.organization}`
).join('\n\n')}

Output in JSON format, ordered by relevance:
[
  {"index": 0, "score": 0.9, "reason": "reason"},
  {"index": 2, "score": 0.8, "reason": "reason"}
]`
    };

    return prompts[language as keyof typeof prompts] || prompts.ja;
  }

  /**
   * データセットを処理してOpenDataItemに変換
   */
  private async processDataset(
    dataset: CKANDataset, 
    originalQuery: string,
    language: SupportedLanguage
  ): Promise<OpenDataItem[]> {
    const items: OpenDataItem[] = [];

    try {
      // データセット概要アイテムを作成
      const summaryItem = this.createDatasetSummaryItem(dataset, language);
      items.push(summaryItem);

      // 処理可能なリソースからデータを取得
      const processableResources = dataset.resources.filter(resource => 
        this.isSupportedFormat(resource.format)
      );

      for (const resource of processableResources.slice(0, 2)) { // 最大2リソース
        try {
          const resourceItems = await this.processResource(resource, dataset, originalQuery, language);
          items.push(...resourceItems);
        } catch (error) {
          log.warn('Failed to process resource', {
            resourceId: resource.id,
            format: resource.format,
            error: (error as Error).message
          });
        }
      }

      return items;
    } catch (error) {
      log.error('Failed to process dataset', error as Error, {
        datasetId: dataset.id
      });
      return [];
    }
  }

  private createDatasetSummaryItem(dataset: CKANDataset, language: SupportedLanguage): OpenDataItem {
    const category = this.extractCategory(dataset);
    const tags = dataset.tags.map(tag => tag.name);
    
    return {
      id: `${dataset.id}-summary`,
      title: dataset.title,
      description: dataset.notes || '東京都オープンデータ',
      category: category as OpenDataCategory,
      tags: [...tags, '東京都', 'オープンデータ'],
      content: this.generateDatasetSummaryContent(dataset, language),
      metadata: {
        source: `東京都オープンデータ: ${dataset.title}`,
        lastUpdated: new Date(dataset.metadata_modified || dataset.metadata_created),
        language,
        datasetId: dataset.id,
        organization: dataset.organization?.title,
        license: dataset.license_title
      }
    };
  }

  private generateDatasetSummaryContent(dataset: CKANDataset, language: SupportedLanguage): string {
    const templates = {
      ja: `# ${dataset.title}

## 概要
${dataset.notes || 'データセットの詳細な説明は提供されていません。'}

## データセット情報
- **提供組織**: ${dataset.organization?.title || '東京都'}
- **最終更新**: ${new Date(dataset.metadata_modified || dataset.metadata_created).toLocaleDateString('ja-JP')}
- **ライセンス**: ${dataset.license_title || '未指定'}
- **タグ**: ${dataset.tags.map(tag => tag.name).join('、')}

## 利用可能なリソース
${dataset.resources.map(resource => 
  `- ${resource.name || 'データファイル'} (${resource.format})`
).join('\n')}

東京都オープンデータポータルより提供されている公式データです。`,
      en: `# ${dataset.title}

## Overview
${dataset.notes || 'No detailed description provided for this dataset.'}

## Dataset Information
- **Organization**: ${dataset.organization?.title || 'Tokyo Metropolitan Government'}
- **Last Updated**: ${new Date(dataset.metadata_modified || dataset.metadata_created).toLocaleDateString('en-US')}
- **License**: ${dataset.license_title || 'Not specified'}
- **Tags**: ${dataset.tags.map(tag => tag.name).join(', ')}

## Available Resources
${dataset.resources.map(resource => 
  `- ${resource.name || 'Data file'} (${resource.format})`
).join('\n')}

Official data provided by Tokyo Open Data Portal.`
    };

    return templates[language as keyof typeof templates] || templates.ja;
  }

  private async processResource(
    resource: any, 
    dataset: CKANDataset, 
    originalQuery: string,
    language: SupportedLanguage
  ): Promise<OpenDataItem[]> {
    try {
      const response = await axios.get(resource.url, {
        timeout: 20000,
        maxContentLength: 10 * 1024 * 1024, // 10MB制限
        headers: {
          'User-Agent': 'Tokyo-AI-Assistant/1.0'
        }
      });

      return this.convertResourceDataToItems(
        response.data, 
        resource, 
        dataset, 
        originalQuery,
        language
      );
    } catch (error) {
      log.warn('Failed to fetch resource data', {
        resourceId: resource.id,
        url: resource.url,
        error: (error as Error).message
      });
      return [];
    }
  }

  private convertResourceDataToItems(
    data: any, 
    resource: any, 
    dataset: CKANDataset, 
    originalQuery: string,
    language: SupportedLanguage
  ): OpenDataItem[] {
    const items: OpenDataItem[] = [];
    
    try {
      if (Array.isArray(data) && data.length > 0) {
        // 配列データの場合、関連性の高いエントリを抽出
        const relevantEntries = this.findRelevantEntries(data, originalQuery);
        
        relevantEntries.slice(0, 3).forEach((entry, index) => {
          const item = this.createResourceEntryItem(
            entry, 
            resource, 
            dataset, 
            index,
            language
          );
          items.push(item);
        });
      } else if (typeof data === 'object') {
        // オブジェクトデータの場合
        const item = this.createResourceEntryItem(
          data, 
          resource, 
          dataset, 
          0,
          language
        );
        items.push(item);
      }
    } catch (error) {
      log.error('Failed to convert resource data', error as Error, {
        resourceId: resource.id
      });
    }

    return items;
  }

  private findRelevantEntries(data: any[], query: string): any[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return data
      .map(entry => {
        let score = 0;
        const entryText = JSON.stringify(entry).toLowerCase();
        
        queryWords.forEach(word => {
          if (entryText.includes(word)) {
            score += 1;
          }
        });
        
        return { entry, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.entry);
  }

  private createResourceEntryItem(
    entry: any, 
    resource: any, 
    dataset: CKANDataset, 
    index: number,
    language: SupportedLanguage
  ): OpenDataItem {
    const title = this.extractEntryTitle(entry, dataset.title);
    const description = this.extractEntryDescription(entry, resource.description);
    const content = this.formatEntryContent(entry, language);
    const category = this.extractCategory(dataset);
    
    return {
      id: `${dataset.id}-${resource.id}-${index}`,
      title,
      description,
      category: category as OpenDataCategory,
      tags: [...dataset.tags.map(tag => tag.name), 'データエントリ'],
      content,
      metadata: {
        source: `東京都オープンデータ: ${dataset.title} - ${resource.name}`,
        lastUpdated: new Date(resource.last_modified || dataset.metadata_modified),
        language,
        datasetId: dataset.id,
        resourceId: resource.id,
        organization: dataset.organization?.title
      }
    };
  }

  private extractEntryTitle(entry: any, datasetTitle: string): string {
    const titleFields = ['name', 'title', '名称', '施設名', '事業名', 'facility_name', '項目名'];
    
    for (const field of titleFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        return `${datasetTitle} - ${entry[field].substring(0, 50)}`;
      }
    }

    // フォールバック
    const firstStringValue = Object.values(entry).find(value => 
      typeof value === 'string' && value.trim().length > 0
    ) as string;
    
    if (firstStringValue) {
      return `${datasetTitle} - ${firstStringValue.substring(0, 30)}`;
    }

    return `${datasetTitle} - データエントリ`;
  }

  private extractEntryDescription(entry: any, resourceDescription: string): string {
    const descFields = ['description', 'summary', '説明', '概要', 'details'];
    
    for (const field of descFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        return entry[field].substring(0, 200);
      }
    }

    return resourceDescription || '東京都オープンデータのエントリです。';
  }

  private formatEntryContent(entry: any, language: SupportedLanguage): string {
    const templates = {
      ja: '## データ詳細\n\n',
      en: '## Data Details\n\n'
    };
    
    let content = templates[language as keyof typeof templates] || templates.ja;
    
    Object.entries(entry).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        content += `**${key}**: ${value}\n`;
      }
    });

    return content || 'データエントリの詳細情報';
  }

  private extractCategory(dataset: CKANDataset): string {
    // グループ情報からカテゴリを推定
    if (dataset.groups && dataset.groups.length > 0) {
      return dataset.groups[0].title || dataset.groups[0].name;
    }

    // タグからカテゴリを推定
    const categoryKeywords = {
      '子育て': ['子育て', '保育', '育児', '児童'],
      '教育': ['教育', '学校', '学習'],
      '福祉': ['福祉', '介護', '高齢者'],
      '環境': ['環境', '気象', 'ごみ'],
      '交通': ['交通', '道路', '電車'],
      '防災': ['防災', '災害', '避難'],
      '経済': ['経済', '産業', '企業'],
      '観光': ['観光', '文化', 'イベント']
    };

    const tags = dataset.tags.map(tag => tag.name).join(' ');
    const text = `${dataset.title} ${dataset.notes} ${tags}`.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  private isSupportedFormat(format: string): boolean {
    const supportedFormats = ['JSON', 'CSV', 'TSV', 'XLS', 'XLSX'];
    return supportedFormats.includes(format?.toUpperCase());
  }

  private getFallbackData(query: string, language: SupportedLanguage): OpenDataItem[] {
    const templates = {
      ja: {
        title: 'お探しの情報について',
        description: 'ご質問にお答えできるよう努めます',
        content: `申し訳ございませんが、「${query}」に関する具体的なオープンデータが見つかりませんでした。

東京都では9,742件のオープンデータを公開しています。以下の方法でより詳しい情報を得ることができます：

1. **東京都オープンデータカタログ** (https://catalog.data.metro.tokyo.lg.jp/)
2. **各区市町村の公式ホームページ**
3. **東京都公式ホームページ** (https://www.metro.tokyo.lg.jp/)

より具体的なキーワードや分野を指定していただければ、関連するデータを見つけやすくなります。`
      },
      en: {
        title: 'About Your Inquiry',
        description: 'We strive to answer your questions',
        content: `I apologize, but I could not find specific open data related to "${query}".

Tokyo provides 9,742 open datasets. You can get more detailed information through:

1. **Tokyo Open Data Catalog** (https://catalog.data.metro.tokyo.lg.jp/)
2. **Official websites of each ward/city/town**
3. **Tokyo Metropolitan Government Official Website** (https://www.metro.tokyo.lg.jp/)

Please provide more specific keywords or fields to help find relevant data.`
      }
    };

    const template = templates[language as keyof typeof templates] || templates.ja;

    return [{
      id: 'fallback-general',
      title: template.title,
      description: template.description,
      category: 'general',
      tags: ['案内', 'ヘルプ'],
      content: template.content,
      metadata: {
        source: 'システム',
        lastUpdated: new Date(),
        language
      }
    }];
  }

  /**
   * 利用可能なデータソース一覧を取得
   */
  async getAvailableDataSources(): Promise<DataSource[]> {
    try {
      const url = `${this.apiBaseUrl}/action/organization_list`;
      const response = await axios.get(url, {
        params: { all_fields: true },
        timeout: 10000
      });

      if (response.data.success && response.data.result) {
        return response.data.result.map((org: any) => ({
          id: org.name,
          title: org.title,
          url: `${this.catalogBaseUrl}/organization/${org.name}`,
          description: org.description || '東京都オープンデータ提供組織',
          category: 'organization',
          lastUpdated: new Date(org.created)
        }));
      }
    } catch (error) {
      log.error('Failed to fetch data sources', error as Error);
    }

    return [{
      id: 'tokyo-metro',
      title: '東京都',
      url: this.catalogBaseUrl,
      description: '東京都オープンデータポータル',
      category: 'organization',
      lastUpdated: new Date()
    }];
  }

  /**
   * 特定のカテゴリのデータを検索
   */
  async searchByCategory(category: string, limit: number = 20): Promise<OpenDataItem[]> {
    const searchParams = {
      keywords: [],
      categories: [category],
      organizations: [],
      tags: []
    };

    const datasets = await this.searchDatasets(searchParams);
    const items: OpenDataItem[] = [];

    for (const dataset of datasets.slice(0, Math.min(limit, 10))) {
      try {
        const datasetItems = await this.processDataset(dataset, category, 'ja');
        items.push(...datasetItems);
      } catch (error) {
        log.warn('Failed to process dataset in category search', {
          datasetId: dataset.id,
          category,
          error: (error as Error).message
        });
      }
    }

    return items;
  }

  /**
   * 統計情報を取得
   */
  async getStats(): Promise<{
    totalDatasets: number;
    categories: Array<{ name: string; count: number }>;
    organizations: Array<{ name: string; title: string; count: number }>;
    lastUpdated: Date;
  }> {
    try {
      // 全データセット数を取得
      const countResponse = await axios.get(`${this.apiBaseUrl}/action/package_search`, {
        params: { q: '*:*', rows: 0 },
        timeout: 10000
      });

      const totalDatasets = countResponse.data.result?.count || 0;

      // 組織一覧を取得
      const orgResponse = await axios.get(`${this.apiBaseUrl}/action/organization_list`, {
        params: { all_fields: true },
        timeout: 10000
      });

      const organizations = orgResponse.data.result?.map((org: any) => ({
        name: org.name,
        title: org.title,
        count: org.package_count || 0
      })) || [];

      return {
        totalDatasets,
        categories: [], // CKANのグループAPIで取得可能
        organizations,
        lastUpdated: new Date()
      };
    } catch (error) {
      log.error('Failed to get stats', error as Error);
      return {
        totalDatasets: 0,
        categories: [],
        organizations: [],
        lastUpdated: new Date()
      };
    }
  }
}