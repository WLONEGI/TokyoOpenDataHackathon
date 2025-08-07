import { OpenDataItem, SupportedLanguage } from '@/types';
import { GeminiService } from './GeminiService';
import { TokyoOpenDataService } from './TokyoOpenDataService';
import { getSearchCache } from '@/lib/cache/SearchCache';
import { log } from '@/lib/logger';

interface SimpleRAGResponse {
  content: string;
  sources: OpenDataItem[];
  confidence: number;
  processingTime: number;
}

interface StreamingStep {
  step: string;
  status: 'started' | 'completed' | 'failed';
  message: string;
  timestamp: number;
  data?: any;
}

type StreamingCallback = (step: StreamingStep) => void;

/**
 * シンプルなRAG（Retrieval-Augmented Generation）サービス
 * 複雑な推論や自律的機能を排除し、行政情報への正確な応答に特化
 */
export class SimpleRAGService {
  private geminiService: GeminiService;
  private openDataService: TokyoOpenDataService;
  private cache = getSearchCache();

  constructor() {
    this.geminiService = new GeminiService();
    this.openDataService = new TokyoOpenDataService();
  }

  /**
   * ストリーミング対応：思考過程をリアルタイムで通知しながら処理
   */
  async processQueryStreaming(
    query: string, 
    language: SupportedLanguage = 'ja',
    onStep: StreamingCallback
  ): Promise<SimpleRAGResponse> {
    const startTime = Date.now();
    
    const emitStep = (step: string, status: StreamingStep['status'], message: string, data?: any) => {
      onStep({
        step,
        status,
        message,
        timestamp: Date.now() - startTime,
        data
      });
    };

    try {
      emitStep('start', 'started', '質問を処理しています...', { query: query.substring(0, 50) });
      
      log.info('SimpleRAG streaming processing started', { 
        query: query.substring(0, 100),
        language 
      });

      // 1. キャッシュチェック
      emitStep('cache-check', 'started', 'キャッシュを確認しています...');
      const cacheKey = this.generateCacheKey(query, language);
      const cachedResult = this.cache.get({ text: query, language });
      
      if (cachedResult) {
        emitStep('cache-check', 'completed', 'キャッシュからデータを取得しました');
        emitStep('response-generation', 'completed', '応答を生成しました');
        log.info('Cache hit for streaming query', { query: query.substring(0, 50) });
        return this.formatCachedResponse(cachedResult, startTime);
      }
      emitStep('cache-check', 'completed', 'キャッシュにデータが見つかりませんでした');

      // 2. 行政データ検索の必要性を判別
      emitStep('search-decision', 'started', '質問内容を分析しています...');
      const needsDataSearch = await this.shouldSearchAdministrativeData(query, language);
      emitStep('search-decision', 'completed', 
        needsDataSearch ? 'データ検索が必要と判断されました' : 'データ検索は不要と判断されました',
        { needsSearch: needsDataSearch }
      );

      let relevantData: OpenDataItem[] = [];

      if (needsDataSearch) {
        // 3. キーワード抽出
        emitStep('keyword-extraction', 'started', 'キーワードを抽出しています...');
        const keywords = this.extractKeywords(query, language);
        emitStep('keyword-extraction', 'completed', `${keywords.length}個のキーワードを抽出しました`, 
          { keywords: keywords.slice(0, 5) });

        // 4. データ検索
        emitStep('data-search', 'started', '東京都オープンデータを検索しています...');
        relevantData = await this.searchRelevantData(keywords, language);
        emitStep('data-search', 'completed', `${relevantData.length}件のデータを取得しました`,
          { count: relevantData.length });
      } else {
        emitStep('data-search', 'completed', 'データ検索をスキップしました');
      }

      // 5. 応答生成
      emitStep('response-generation', 'started', 'AI応答を生成しています...');
      const response = await this.generateResponse(query, relevantData, language);
      emitStep('response-generation', 'completed', '応答を生成しました', 
        { length: response.length });

      // 6. 結果キャッシュ
      emitStep('caching', 'started', '結果をキャッシュしています...');
      const result: SimpleRAGResponse = {
        content: response,
        sources: relevantData,
        confidence: this.calculateConfidence(relevantData.length, needsDataSearch),
        processingTime: Date.now() - startTime
      };

      // キャッシュに保存
      this.cache.set({ text: query, language }, {
        items: relevantData,
        total: relevantData.length,
        query,
        processingTime: result.processingTime,
        usedCache: false
      });
      emitStep('caching', 'completed', '結果をキャッシュしました');

      emitStep('complete', 'completed', '処理が完了しました', {
        sourceCount: relevantData.length,
        confidence: result.confidence,
        processingTime: result.processingTime
      });

      log.info('SimpleRAG streaming processing completed', {
        query: query.substring(0, 50),
        sourceCount: relevantData.length,
        processingTime: result.processingTime,
        confidence: result.confidence,
        usedDataSearch: needsDataSearch
      });

      return result;

    } catch (error) {
      emitStep('error', 'failed', 'エラーが発生しました', { error: (error as Error).message });
      
      log.error('SimpleRAG streaming processing failed', error as Error, {
        query: query.substring(0, 50),
        language
      });

      return this.generateErrorResponse(error as Error, language, startTime);
    }
  }

  /**
   * メイン処理：質問に対してシンプルなRAG応答を生成
   */
  async processQuery(query: string, language: SupportedLanguage = 'ja'): Promise<SimpleRAGResponse> {
    const startTime = Date.now();
    
    try {
      log.info('SimpleRAG processing started', { 
        query: query.substring(0, 100),
        language 
      });

      // 1. キャッシュチェック
      const cacheKey = this.generateCacheKey(query, language);
      const cachedResult = this.cache.get({ text: query, language });
      
      if (cachedResult) {
        log.info('Cache hit for query', { query: query.substring(0, 50) });
        return this.formatCachedResponse(cachedResult, startTime);
      }

      // 2. 行政データ検索の必要性を判別
      const needsDataSearch = await this.shouldSearchAdministrativeData(query, language);
      log.debug('Data search decision', { needsDataSearch, query: query.substring(0, 50) });

      let relevantData: OpenDataItem[] = [];

      if (needsDataSearch) {
        // 3. キーワード抽出
        const keywords = this.extractKeywords(query, language);
        log.debug('Keywords extracted', { keywords });

        // 4. データ検索
        relevantData = await this.searchRelevantData(keywords, language);
        log.debug('Data retrieved', { count: relevantData.length });
      } else {
        log.debug('Skipped data search - not required for this query type');
      }

      // 5. 応答生成
      const response = await this.generateResponse(query, relevantData, language);

      // 6. 結果キャッシュ
      const result: SimpleRAGResponse = {
        content: response,
        sources: relevantData,
        confidence: this.calculateConfidence(relevantData.length, needsDataSearch),
        processingTime: Date.now() - startTime
      };

      // キャッシュに保存
      this.cache.set({ text: query, language }, {
        items: relevantData,
        total: relevantData.length,
        query,
        processingTime: result.processingTime,
        usedCache: false
      });

      log.info('SimpleRAG processing completed', {
        query: query.substring(0, 50),
        sourceCount: relevantData.length,
        processingTime: result.processingTime,
        confidence: result.confidence,
        usedDataSearch: needsDataSearch
      });

      return result;

    } catch (error) {
      log.error('SimpleRAG processing failed', error as Error, {
        query: query.substring(0, 50),
        language
      });

      return this.generateErrorResponse(error as Error, language, startTime);
    }
  }

  /**
   * 行政データ検索の必要性を判別
   */
  private async shouldSearchAdministrativeData(query: string, language: SupportedLanguage): Promise<boolean> {
    try {
      // 1. パターンマッチングによる基本判別
      const basicDecision = this.basicSearchDecision(query, language);
      if (basicDecision.isDefinitive) {
        log.debug('Basic pattern matching decision', { 
          needsSearch: basicDecision.needsSearch,
          reason: basicDecision.reason 
        });
        return basicDecision.needsSearch;
      }

      // 2. AIによる詳細判別（基本判別で確定しない場合）
      const aiDecision = await this.aiSearchDecision(query, language);
      log.debug('AI-based decision', { 
        needsSearch: aiDecision,
        query: query.substring(0, 50) 
      });
      
      return aiDecision;
    } catch (error) {
      log.warn('Failed to determine search necessity', { 
        error: (error as Error).message,
        fallback: 'searching-data' 
      });
      
      // エラー時は安全側に倒してデータ検索を実行
      return true;
    }
  }

  /**
   * パターンマッチングによる基本判別
   */
  private basicSearchDecision(query: string, language: SupportedLanguage): {
    isDefinitive: boolean;
    needsSearch: boolean;
    reason: string;
  } {
    const lowerQuery = query.toLowerCase().trim();
    
    // 確実に検索不要なパターン
    const noSearchPatterns = {
      ja: [
        // 挨拶
        /^(おはよう|こんにちは|こんばんは|はじめまして|お疲れ様|よろしく)/,
        // 感謝・謝罪
        /^(ありがとう|すみません|申し訳|失礼)/,
        // システム関連質問
        /^(あなたは|君は|システム|AI|人工知能|使い方|操作方法)/,
        // 一般的な雑談
        /^(今日は|天気|気温|時間|何時|どうですか)/,
        // 終了の挨拶
        /^(さようなら|また|終了|やめ|バイバイ)/
      ],
      en: [
        /^(hello|hi|good morning|good afternoon|good evening|thank you|thanks|sorry)/,
        /^(what are you|who are you|how to use|weather|time|goodbye|bye)/
      ],
      zh: [
        /^(你好|早上好|下午好|晚上好|谢谢|对不起|再见)/,
        /^(你是|系统|怎么用|天气|时间)/
      ],
      ko: [
        /^(안녕|감사|죄송|안녕히|시스템|날씨|시간)/
      ]
    };

    // 確実に検索必要なパターン
    const needSearchPatterns = {
      ja: [
        // 子育て関連
        /(保育園|幼稚園|児童館|子育て|育児|出産|妊娠|小児科|予防接種)/,
        // 福祉関連
        /(介護|高齢者|障害|福祉|年金|医療費|生活保護)/,
        // 教育関連
        /(学校|入学|教育|図書館|奨学金)/,
        // 住宅関連
        /(住宅|家賃|公営住宅|都営住宅|引っ越し)/,
        // 防災関連
        /(災害|避難|防災|地震|台風|洪水|避難所)/,
        // 手続き関連
        /(申請|手続き|届出|証明書|住民票|戸籍|印鑑登録|転入|転出)/,
        // 施設関連
        /(区役所|市役所|公民館|体育館|プール|公園)/,
        // 東京都特有
        /(都バス|都営|メトロ|JR|小田急|京王|東急|西武|東武)/
      ],
      en: [
        /(childcare|nursery|kindergarten|school|education|welfare|disaster|evacuation|application|certificate)/
      ],
      zh: [
        /(托儿|幼儿园|学校|教育|福利|灾害|避难|申请|证明)/
      ],
      ko: [
        /(어린이집|유치원|학교|교육|복지|재해|대피|신청|증명)/
      ]
    };

    const patterns = noSearchPatterns[language as keyof typeof noSearchPatterns] || noSearchPatterns.ja;
    const searchPatterns = needSearchPatterns[language as keyof typeof needSearchPatterns] || needSearchPatterns.ja;

    // 検索不要パターンのチェック
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery)) {
        return {
          isDefinitive: true,
          needsSearch: false,
          reason: 'matched_no_search_pattern'
        };
      }
    }

    // 検索必要パターンのチェック
    for (const pattern of searchPatterns) {
      if (pattern.test(lowerQuery)) {
        return {
          isDefinitive: true,
          needsSearch: true,
          reason: 'matched_search_pattern'
        };
      }
    }

    // どちらにも該当しない場合は非確定
    return {
      isDefinitive: false,
      needsSearch: false,
      reason: 'no_definitive_pattern_match'
    };
  }

  /**
   * AI による検索必要性判別
   */
  private async aiSearchDecision(query: string, language: SupportedLanguage): Promise<boolean> {
    try {
      const prompt = this.buildSearchDecisionPrompt(query, language);
      const response = await this.geminiService.generateText(prompt, undefined, language);
      
      // 簡単なパースロジック
      const decision = response.toLowerCase().includes('true') || 
                     response.toLowerCase().includes('必要') ||
                     response.toLowerCase().includes('yes');
      
      return decision;
    } catch (error) {
      log.warn('AI search decision failed', { error: (error as Error).message });
      // AIが失敗した場合は検索を実行（安全側）
      return true;
    }
  }

  /**
   * 検索判別用プロンプト構築
   */
  private buildSearchDecisionPrompt(query: string, language: SupportedLanguage): string {
    const prompts = {
      ja: `
以下のユーザーの質問に答えるために、東京都の行政データ（オープンデータ）を検索する必要がありますか？

ユーザーの質問: "${query}"

【検索が必要な場合の例】
- 保育園、学校、病院などの施設情報
- 行政手続きや申請方法
- 福祉サービスや給付金
- 防災・避難所情報
- 交通機関の情報
- 各種証明書の取得方法

【検索が不要な場合の例】
- 挨拶（こんにちは、ありがとう等）
- システムに関する質問（あなたは何ですか等）
- 一般的な雑談（天気、時間等）
- 東京都と関係ない一般的な質問

"true" または "false" で回答してください。`,
      
      en: `
Does answering the following user question require searching Tokyo administrative data (open data)?

User question: "${query}"

【Cases requiring search】
- Facility information (nurseries, schools, hospitals)
- Administrative procedures and applications
- Welfare services and benefits
- Disaster prevention and evacuation information
- Transportation information
- Certificate acquisition methods

【Cases not requiring search】
- Greetings (hello, thank you, etc.)
- System-related questions (what are you, etc.)
- General chat (weather, time, etc.)
- General questions unrelated to Tokyo

Answer with "true" or "false".`
    };

    return prompts[language as keyof typeof prompts] || prompts.ja;
  }

  /**
   * キーワード抽出（シンプルな実装）
   */
  private extractKeywords(query: string, language: SupportedLanguage): string[] {
    const stopWords = this.getStopWords(language);
    
    // 基本的な前処理とキーワード抽出
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // 句読点を除去
      .split(/\s+/)
      .filter(word => word.length > 1)
      .filter(word => !stopWords.includes(word));

    // 重複除去と最大キーワード数制限
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * 関連データの検索
   */
  private async searchRelevantData(keywords: string[], language: SupportedLanguage): Promise<OpenDataItem[]> {
    try {
      // 東京都オープンデータサービスから検索
      const searchQuery = keywords.join(' ');
      const items = await this.openDataService.fetchRelevantData(searchQuery, language);
      
      // 最大件数制限（性能とコスト効率のため）
      return items.slice(0, 5);
    } catch (error) {
      log.warn('Data search failed', { 
        keywords, 
        language,
        error: (error as Error).message 
      });
      return [];
    }
  }

  /**
   * Gemini APIを使用した応答生成
   */
  private async generateResponse(
    query: string, 
    data: OpenDataItem[], 
    language: SupportedLanguage
  ): Promise<string> {
    const prompt = this.buildPrompt(query, data, language);
    
    try {
      return await this.geminiService.generateText(prompt, undefined, language);
    } catch (error) {
      log.warn('Response generation failed', { error: (error as Error).message });
      return this.getFallbackResponse(language);
    }
  }

  /**
   * プロンプト構築
   */
  private buildPrompt(query: string, data: OpenDataItem[], language: SupportedLanguage): string {
    const templates = {
      ja: {
        system: `あなたは東京都の行政情報に関する質問に正確に答えるAIアシスタントです。
以下のガイドラインに従って回答してください：

1. 提供された参考データのみを使用して回答する
2. データにない情報は推測せず、「提供されたデータでは確認できません」と回答する
3. 簡潔で分かりやすい言葉で説明する
4. 必要に応じて具体的な手続きや連絡先を案内する`,
        
        userPrompt: (query: string, dataContext: string) => `
参考データ:
${dataContext}

質問: ${query}

参考データに基づいて、正確で有用な回答を提供してください。データにない情報については推測せず、その旨を明記してください。`
      },
      
      en: {
        system: `You are an AI assistant that accurately answers questions about Tokyo administrative information.
Please follow these guidelines:

1. Use only the provided reference data for your answers
2. Do not speculate on information not in the data; respond with "This information is not available in the provided data"
3. Explain in clear and simple language
4. Provide specific procedures or contact information when necessary`,
        
        userPrompt: (query: string, dataContext: string) => `
Reference Data:
${dataContext}

Question: ${query}

Based on the reference data, provide an accurate and useful answer. For information not in the data, do not speculate and clearly indicate that.`
      }
    };

    const template = templates[language as keyof typeof templates] || templates.ja;
    
    // データコンテキストの構築
    const dataContext = data.length > 0 
      ? data.map((item, index) => 
          `${index + 1}. ${item.title}\n   ${item.description}\n   ${item.content.substring(0, 200)}...`
        ).join('\n\n')
      : language === 'ja' 
        ? '関連するデータが見つかりませんでした。'
        : 'No relevant data found.';

    return template.system + '\n\n' + template.userPrompt(query, dataContext);
  }

  /**
   * 信頼度計算
   */
  private calculateConfidence(dataCount: number, needsDataSearch: boolean = true): number {
    // データ検索が不要な質問（挨拶など）は高い信頼度
    if (!needsDataSearch) {
      return 0.9;
    }
    
    // データ検索が必要な質問の場合
    if (dataCount === 0) return 0.2;
    if (dataCount >= 3) return 0.8;
    return 0.4 + (dataCount * 0.2);
  }

  /**
   * キャッシュキー生成
   */
  private generateCacheKey(query: string, language: SupportedLanguage): string {
    return `rag_${language}_${query.toLowerCase().replace(/\s+/g, '_').substring(0, 50)}`;
  }

  /**
   * キャッシュ結果のフォーマット
   */
  private formatCachedResponse(cachedResult: any, startTime: number): SimpleRAGResponse {
    return {
      content: `キャッシュから取得した結果です。\n\n${cachedResult.items[0]?.description || '関連情報が見つかりました。'}`,
      sources: cachedResult.items || [],
      confidence: this.calculateConfidence(cachedResult.items?.length || 0),
      processingTime: Date.now() - startTime
    };
  }

  /**
   * エラー応答生成
   */
  private generateErrorResponse(error: Error, language: SupportedLanguage, startTime: number): SimpleRAGResponse {
    const errorMessages = {
      ja: '申し訳ございませんが、システムエラーが発生しました。しばらく後にもう一度お試しください。',
      en: 'Sorry, a system error occurred. Please try again later.',
      zh: '抱歉，系统发生错误。请稍后重试。',
      ko: '죄송합니다. 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    };

    return {
      content: errorMessages[language] || errorMessages.ja,
      sources: [],
      confidence: 0.1,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * フォールバック応答
   */
  private getFallbackResponse(language: SupportedLanguage): string {
    const fallbackMessages = {
      ja: '申し訳ございませんが、現在この質問にお答えできません。東京都の公式ホームページや各区市町村の窓口でご確認ください。',
      en: 'Sorry, I cannot answer this question at the moment. Please check the official Tokyo Metropolitan Government website or contact your local municipal office.',
      zh: '抱歉，目前无法回答这个问题。请查看东京都官方网站或联系当地市区町村窗口。',
      ko: '죄송합니다. 현재 이 질문에 답할 수 없습니다. 도쿄도 공식 홈페이지나 각 구시정촌 창구에서 확인해주세요.'
    };

    return fallbackMessages[language] || fallbackMessages.ja;
  }

  /**
   * ストップワード取得
   */
  private getStopWords(language: SupportedLanguage): string[] {
    const stopWords = {
      ja: ['は', 'が', 'を', 'に', 'で', 'と', 'の', 'から', 'まで', 'など', 'について', 'に関して', 'を教えて', 'ください', 'です', 'ます', 'である'],
      en: ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'for', 'to', 'of', 'as', 'by'],
      zh: ['的', '是', '在', '有', '和', '与', '或', '但', '因为', '所以', '如果', '那么', '这个', '那个'],
      ko: ['은', '는', '이', '가', '을', '를', '에', '에서', '와', '과', '의', '으로', '로', '에게', '한테']
    };

    return stopWords[language] || stopWords.ja;
  }

  /**
   * サービス統計取得
   */
  getStats(): {
    cacheHitRate: number;
    totalQueries: number;
    averageProcessingTime: number;
  } {
    // 簡単な統計情報（実際の実装では永続化されたメトリクスを使用）
    return {
      cacheHitRate: 0.0, // キャッシュの実装に依存
      totalQueries: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    // 必要に応じてリソースクリーンアップ
    log.info('SimpleRAGService cleanup completed');
  }
}