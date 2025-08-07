import axios from 'axios';
import { OpenDataItem, DataSource } from '@/types';
import { log } from '@/lib/logger';

export class OpenDataService {
  private catalogBaseUrl = 'https://catalog.data.metro.tokyo.lg.jp';
  private storageBaseUrl = 'https://data.storage.data.metro.tokyo.lg.jp';

  // 育児・子育て関連のデータセットID（MVP用）
  private childcareDatasets = [
    't134211d0000000001', // 子育て支援制度レジストリ
    't132012d0000000032', // 学童保育所一覧
    't131105d0000000209', // 小規模保育所
    't132217d3100000001', // 子ども食堂一覧
  ];

  async fetchChildcareData(): Promise<OpenDataItem[]> {
    const items: OpenDataItem[] = [];

    try {
      // Try to fetch real data from Tokyo Open Data
      const realData = await this.fetchRealChildcareData();
      if (realData.length > 0) {
        items.push(...realData);
        log.info('Successfully fetched real Tokyo Open Data', { count: realData.length });
      } else {
        // Fallback to sample data if real data is not available
        const sampleData = await this.generateSampleChildcareData();
        items.push(...sampleData);
        log.warn('Using sample data as fallback', { count: sampleData.length });
      }

      return items;
    } catch (error) {
      log.error('Error fetching childcare data', error as Error);
      console.error('Error fetching childcare data:', error);
      return this.getFallbackChildcareData();
    }
  }

  private async fetchRealChildcareData(): Promise<OpenDataItem[]> {
    const items: OpenDataItem[] = [];

    try {
      // Fetch data from multiple datasets in parallel
      const datasetPromises = this.childcareDatasets.map(datasetId => 
        this.fetchDatasetById(datasetId)
      );

      const results = await Promise.allSettled(datasetPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          items.push(...result.value);
          log.debug('Dataset fetched successfully', { 
            datasetId: this.childcareDatasets[index], 
            itemCount: result.value.length 
          });
        } else if (result.status === 'rejected') {
          log.warn('Failed to fetch dataset', { 
            datasetId: this.childcareDatasets[index],
            error: result.reason 
          });
        }
      });

      return items;
    } catch (error) {
      log.error('Error in fetchRealChildcareData', error as Error);
      return [];
    }
  }

  private async fetchDatasetById(datasetId: string): Promise<OpenDataItem[]> {
    try {
      // First, get the dataset metadata
      const metadataUrl = `${this.catalogBaseUrl}/api/3/action/package_show?id=${datasetId}`;
      const metadataResponse = await axios.get(metadataUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Tokyo-AI-Assistant/1.0',
        }
      });

      if (!metadataResponse.data.success) {
        throw new Error(`Failed to fetch metadata for dataset ${datasetId}`);
      }

      const dataset = metadataResponse.data.result;
      const items: OpenDataItem[] = [];

      // Process each resource in the dataset
      for (const resource of dataset.resources || []) {
        if (this.isSupportedFormat(resource.format)) {
          const resourceItems = await this.fetchResourceData(resource, dataset);
          items.push(...resourceItems);
        }
      }

      return items;
    } catch (error) {
      log.warn('Failed to fetch dataset', { datasetId, error: (error as Error).message });
      return [];
    }
  }

  private isSupportedFormat(format: string): boolean {
    const supportedFormats = ['JSON', 'CSV', 'TSV', 'XML'];
    return supportedFormats.includes(format?.toUpperCase());
  }

  private async fetchResourceData(resource: any, dataset: any): Promise<OpenDataItem[]> {
    try {
      const response = await axios.get(resource.url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Tokyo-AI-Assistant/1.0',
        }
      });

      // Convert the resource data to OpenDataItem format
      return this.convertToOpenDataItems(response.data, resource, dataset);
    } catch (error) {
      log.warn('Failed to fetch resource data', { 
        resourceId: resource.id, 
        url: resource.url, 
        error: (error as Error).message 
      });
      return [];
    }
  }

  private convertToOpenDataItems(data: any, resource: any, dataset: any): OpenDataItem[] {
    const items: OpenDataItem[] = [];
    
    try {
      // Create a summary item for the entire dataset
      const summaryItem: OpenDataItem = {
        id: `${dataset.id}-summary`,
        title: dataset.title || dataset.name,
        description: dataset.notes || 'Tokyo Open Data dataset',
        category: 'childcare',
        tags: dataset.tags?.map((tag: any) => tag.name) || ['東京都', 'オープンデータ'],
        content: this.generateDatasetSummary(data, dataset),
        metadata: {
          source: `東京都オープンデータ: ${dataset.title || dataset.name}`,
          lastUpdated: new Date(dataset.metadata_modified || dataset.metadata_created),
          language: 'ja',
        }
      };

      items.push(summaryItem);

      // If data is an array, create additional items for significant entries
      if (Array.isArray(data) && data.length > 0) {
        const significantEntries = data.slice(0, 5); // Take first 5 entries as examples
        
        significantEntries.forEach((entry, index) => {
          if (entry && typeof entry === 'object') {
            const entryItem: OpenDataItem = {
              id: `${dataset.id}-entry-${index}`,
              title: `${dataset.title} - ${this.extractTitle(entry)}`,
              description: this.extractDescription(entry, dataset.title),
              category: 'childcare',
              tags: [...(dataset.tags?.map((tag: any) => tag.name) || []), 'データエントリ'],
              content: this.formatEntryContent(entry),
              metadata: {
                source: `東京都オープンデータ: ${dataset.title}`,
                lastUpdated: new Date(dataset.metadata_modified || dataset.metadata_created),
                language: 'ja',
              }
            };

            items.push(entryItem);
          }
        });
      }

      log.debug('Converted dataset to OpenDataItems', { 
        datasetId: dataset.id, 
        itemCount: items.length 
      });

      return items;
    } catch (error) {
      log.error('Error converting dataset to OpenDataItems', error as Error, {
        datasetId: dataset.id,
        resourceId: resource.id,
      });
      return [];
    }
  }

  private generateDatasetSummary(data: any, dataset: any): string {
    let summary = `${dataset.title || dataset.name}\n\n`;
    
    if (dataset.notes) {
      summary += `${dataset.notes}\n\n`;
    }

    if (Array.isArray(data)) {
      summary += `【データ概要】\n`;
      summary += `- レコード数: ${data.length}件\n`;
      
      // Analyze data structure
      if (data.length > 0 && typeof data[0] === 'object') {
        const sampleKeys = Object.keys(data[0]);
        summary += `- 項目: ${sampleKeys.slice(0, 10).join('、')}${sampleKeys.length > 10 ? '等' : ''}\n`;
      }
    } else if (typeof data === 'object') {
      summary += `【データ種別】\nオブジェクト形式のデータ\n`;
    }

    summary += `\n【データソース】\n東京都オープンデータポータル\n`;
    summary += `更新日: ${dataset.metadata_modified || dataset.metadata_created}\n`;

    return summary;
  }

  private extractTitle(entry: any): string {
    // Try to find a reasonable title from the entry
    const titleFields = ['name', 'title', '名称', '施設名', '事業名', 'facility_name'];
    
    for (const field of titleFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        return entry[field].substring(0, 50);
      }
    }

    // Fallback: use first non-empty string value
    for (const [key, value] of Object.entries(entry)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return `${key}: ${value.substring(0, 30)}`;
      }
    }

    return 'データエントリ';
  }

  private extractDescription(entry: any, datasetTitle: string): string {
    const descFields = ['description', 'summary', '説明', '概要', 'details'];
    
    for (const field of descFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        return entry[field].substring(0, 200);
      }
    }

    return `${datasetTitle}のデータエントリです。`;
  }

  private formatEntryContent(entry: any): string {
    let content = '';
    
    for (const [key, value] of Object.entries(entry)) {
      if (value !== null && value !== undefined && value !== '') {
        content += `**${key}**: ${value}\n`;
      }
    }

    return content || 'データエントリの詳細情報';
  }

  private async generateSampleChildcareData(): Promise<OpenDataItem[]> {
    return [
      {
        id: 'childcare-001',
        title: '保育園入園申請について',
        description: '東京都内の保育園入園申請の手続きと必要書類について',
        category: 'childcare',
        tags: ['保育園', '入園', '申請', '手続き'],
        content: `
保育園入園申請の手続きについて

【申請時期】
- 4月入園：前年10月〜11月
- 途中入園：入園希望月の前月15日まで

【必要書類】
1. 保育園等利用申込書
2. 就労証明書（両親分）
3. 課税証明書
4. 健康診断書

【申請先】
各区市町村の保育課または子ども家庭支援センター

【選考基準】
保育の必要性の度合いに応じてポイント制で選考
- 就労時間
- 家庭状況
- その他事情

詳細は各自治体のホームページをご確認ください。
        `,
        metadata: {
          source: '東京都子育て支援制度レジストリ',
          lastUpdated: new Date('2024-01-01'),
          language: 'ja'
        }
      },
      {
        id: 'childcare-002',
        title: '学童保育（放課後児童クラブ）について',
        description: '小学生向けの学童保育サービスに関する情報',
        category: 'childcare',
        tags: ['学童保育', '小学生', '放課後', '児童クラブ'],
        content: `
学童保育（放課後児童クラブ）について

【対象】
小学1年生〜6年生（自治体により異なる）

【利用時間】
- 平日：放課後〜18:00（延長保育あり）
- 土曜日：8:00〜18:00
- 長期休暇中：8:00〜18:00

【申請方法】
1. 各自治体の児童課等に申請
2. 就労証明書等の提出
3. 面談・審査

【利用料金】
月額5,000円〜15,000円程度（自治体・世帯収入により異なる）

【サービス内容】
- 宿題指導
- 外遊び・室内遊び
- おやつ提供
- 行事・イベント

詳細は各区市町村にお問い合わせください。
        `,
        metadata: {
          source: '東京都学童保育所一覧',
          lastUpdated: new Date('2024-01-01'),
          language: 'ja'
        }
      },
      {
        id: 'childcare-003',
        title: '子育て支援制度・手当について',
        description: '東京都の子育て世帯向け支援制度と各種手当',
        category: 'childcare',
        tags: ['支援制度', '手当', '補助金', '助成'],
        content: `
子育て支援制度・手当について

【児童手当】
- 0歳〜中学校卒業まで
- 月額：3歳未満15,000円、3歳以上小学校修了前10,000円（第3子以降15,000円）、中学生10,000円

【児童育成手当（東京都）】
- ひとり親世帯等が対象
- 月額13,500円（18歳まで）

【乳幼児医療費助成】
- 中学校3年生まで医療費無料（所得制限あり）

【保育料無償化】
- 3〜5歳児：認可保育園等の利用料無料
- 0〜2歳児：住民税非課税世帯のみ無料

【その他支援】
- 出産育児一時金：50万円
- 産前産後ヘルパー派遣
- 一時保育サービス
- 子育てひろば事業

申請方法や詳細条件は各区市町村窓口にご相談ください。
        `,
        metadata: {
          source: '東京都子育て支援制度レジストリ',
          lastUpdated: new Date('2024-01-01'),
          language: 'ja'
        }
      },
      {
        id: 'childcare-004',
        title: '子ども食堂・地域支援について',
        description: '地域の子ども食堂と子育て支援サービス',
        category: 'childcare',
        tags: ['子ども食堂', '地域支援', 'コミュニティ'],
        content: `
子ども食堂・地域支援について

【子ども食堂とは】
地域の子どもたちが無料または低価格で食事を取れる場所

【主な活動】
- 食事提供（月1〜2回程度）
- 学習支援
- 遊び・交流活動
- 保護者向け相談

【利用方法】
- 事前申込不要（当日参加OK）
- 子どもは無料、大人は300円程度
- 地域住民なら誰でも参加可能

【東京都内の主な子ども食堂】
- 新宿区：約15箇所
- 世田谷区：約30箇所
- 練馬区：約20箇所
- その他各区に複数箇所

【その他地域支援】
- 子育てサロン
- 育児相談
- 一時預かり
- 親子向けイベント

最新情報は各自治体ホームページまたは地域子育て支援センターにお問い合わせください。
        `,
        metadata: {
          source: '東京都子ども食堂一覧',
          lastUpdated: new Date('2024-01-01'),
          language: 'ja'
        }
      }
    ];
  }

  private getFallbackChildcareData(): OpenDataItem[] {
    return [
      {
        id: 'fallback-001',
        title: 'よくある質問：保育園について',
        description: '保育園に関するよくある質問と回答',
        category: 'childcare',
        tags: ['FAQ', '保育園'],
        content: '保育園の申込みや利用に関する基本的な情報を提供しています。詳細は最寄りの区市町村窓口にお問い合わせください。',
        metadata: {
          source: 'システム内蔵データ',
          lastUpdated: new Date(),
          language: 'ja'
        }
      }
    ];
  }

  async searchChildcareInfo(query: string): Promise<OpenDataItem[]> {
    const allData = await this.fetchChildcareData();
    
    // Simple text search implementation
    const searchTerms = query.toLowerCase().split(' ');
    
    return allData.filter(item => {
      const searchableText = (
        item.title + ' ' + 
        item.description + ' ' + 
        item.content + ' ' + 
        item.tags.join(' ')
      ).toLowerCase();
      
      return searchTerms.some(term => searchableText.includes(term));
    });
  }

  async getDataSources(): Promise<DataSource[]> {
    return [
      {
        id: 'tokyo-childcare-registry',
        title: '東京デジタル2030ビジョン（こどもDX）子育て支援制度レジストリ',
        url: 'https://catalog.data.metro.tokyo.lg.jp/dataset/t134211d0000000001',
        description: '東京都の子育て支援制度に関する包括的なデータベース',
        category: 'childcare',
        lastUpdated: new Date('2024-01-01')
      },
      {
        id: 'afterschool-care',
        title: '学童保育所一覧',
        url: 'https://catalog.data.metro.tokyo.lg.jp/dataset/t132012d0000000032',
        description: '東京都内の学童保育所の詳細情報',
        category: 'childcare',
        lastUpdated: new Date('2024-01-01')
      },
      {
        id: 'small-nurseries',
        title: '小規模保育所',
        url: 'https://catalog.data.metro.tokyo.lg.jp/dataset/t131105d0000000209',
        description: '小規模保育所の所在地と詳細情報',
        category: 'childcare',
        lastUpdated: new Date('2024-01-01')
      },
      {
        id: 'kids-cafeteria',
        title: '子ども食堂一覧',
        url: 'https://catalog.data.metro.tokyo.lg.jp/dataset/t132217d3100000001',
        description: '地域の子ども食堂の開催情報',
        category: 'childcare',
        lastUpdated: new Date('2024-01-01')
      }
    ];
  }
}