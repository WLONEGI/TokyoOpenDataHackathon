import { OpenDataItem, SupportedLanguage } from '@/types';
import { log } from '@/lib/logger';
import { GeminiService } from './GeminiService';
import { TokyoOpenDataService } from './TokyoOpenDataService';
import { safeJsonParse } from '@/lib/utils/jsonParser';

interface SearchStrategy {
  goal: string;
  approach: string;
  keywordSets: Array<{
    primary: string[];
    related: string[];
    concepts: string[];
  }>;
  searchPhases: Array<{
    name: string;
    keywords: string[];
    filters: {
      categories?: string[];
      organizations?: string[];
      tags?: string[];
    };
  }>;
  evaluation_criteria: string[];
}

interface SearchResult {
  items: OpenDataItem[];
  strategy: SearchStrategy;
  executionLog: Array<{
    phase: string;
    query: string;
    results: number;
    effectiveness: number;
    insights: string;
  }>;
  confidence: number;
  recommendations: string[];
}

/**
 * 自律的に検索戦略を立案し、実行するAIエージェント
 */
export class AutonomousSearchAgent {
  private geminiService: GeminiService;
  private dataService: TokyoOpenDataService;
  private searchHistory: Map<string, SearchResult> = new Map();

  constructor() {
    this.geminiService = new GeminiService();
    this.dataService = new TokyoOpenDataService();
  }

  /**
   * ユーザーの質問に対して自律的に検索戦略を立案・実行
   */
  async executeAutonomousSearch(
    userQuery: string, 
    language: SupportedLanguage = 'ja'
  ): Promise<SearchResult> {
    try {
      log.info('Starting autonomous search', { 
        query: userQuery.substring(0, 100),
        language 
      });

      // 1. ユーザーの真の意図と目標を理解
      const intent = await this.analyzeUserIntent(userQuery, language);
      log.debug('User intent analyzed', intent as Record<string, any>);

      // 2. 検索戦略を立案
      const strategy = await this.formulateSearchStrategy(userQuery, intent, language);
      log.debug('Search strategy formulated', strategy as Record<string, any>);

      // 3. 戦略に基づいて多段階検索を実行
      const result = await this.executeSearchStrategy(strategy, userQuery, language);
      
      // 4. 結果を評価し、必要に応じて追加検索
      const finalResult = await this.evaluateAndRefineResults(result, userQuery, language);

      // 5. 学習のためにキャッシュ
      this.searchHistory.set(userQuery, finalResult);

      log.info('Autonomous search completed', {
        totalItems: finalResult.items.length,
        confidence: finalResult.confidence,
        phases: finalResult.executionLog.length
      });

      return finalResult;

    } catch (error) {
      log.error('Autonomous search failed', error as Error, { userQuery });
      
      // フォールバック: 従来の検索を実行
      const fallbackItems = await this.dataService.fetchRelevantData(userQuery, language);
      
      return {
        items: fallbackItems,
        strategy: this.createFallbackStrategy(userQuery),
        executionLog: [{
          phase: 'fallback',
          query: userQuery,
          results: fallbackItems.length,
          effectiveness: 0.5,
          insights: 'Fallback search executed due to autonomous search failure'
        }],
        confidence: 0.3,
        recommendations: ['検索キーワードをより具体的にしてください']
      };
    }
  }

  /**
   * ユーザーの真の意図を深く分析
   */
  private async analyzeUserIntent(
    userQuery: string, 
    language: SupportedLanguage
  ): Promise<{
    primaryGoal: string;
    context: string;
    userType: string;
    urgency: string;
    specificNeeds: string[];
    implicitRequirements: string[];
  }> {
    const prompt = this.buildIntentAnalysisPrompt(userQuery, language);
    const response = await this.geminiService.generateText(prompt, undefined, language);
    
    // 安全なJSON解析
    return safeJsonParse(response, {
      primaryGoal: userQuery,
      context: '一般的な情報検索',
      userType: '一般市民',
      urgency: '通常',
      specificNeeds: [userQuery],
      implicitRequirements: []
    });
  }

  private buildIntentAnalysisPrompt(userQuery: string, language: SupportedLanguage): string {
    const prompts = {
      ja: `
以下のユーザーの質問を深く分析し、真の意図と目標を理解してください。

ユーザーの質問: "${userQuery}"

【分析観点】
1. 主要目標: ユーザーが最終的に達成したいことは何か？
2. 文脈・背景: どのような状況でこの質問をしているか？
3. ユーザータイプ: 想定されるユーザーの属性（市民、事業者、研究者等）
4. 緊急度: 情報の緊急性（緊急、重要、通常）
5. 具体的ニーズ: 明示されている具体的な要求
6. 暗黙の要求: 明示されていないが推測される要求

【出力形式】
以下のJSON形式で回答してください：
{
  "primaryGoal": "主要目標の簡潔な説明",
  "context": "想定される文脈・背景",
  "userType": "想定ユーザータイプ",
  "urgency": "緊急度",
  "specificNeeds": ["具体的ニーズ1", "具体的ニーズ2"],
  "implicitRequirements": ["暗黙の要求1", "暗黙の要求2"]
}

例：
- 質問: "子どもが熱を出したときに夜間でも診てもらえる病院はありますか？"
- 分析: 緊急性が高く、夜間診療・小児科・アクセス情報が必要`,
      en: `
Deeply analyze the following user question to understand their true intent and goals.

User question: "${userQuery}"

Analyze from these perspectives:
1. Primary goal: What does the user ultimately want to achieve?
2. Context: What situation prompted this question?
3. User type: Assumed user attributes (citizen, business, researcher, etc.)
4. Urgency: Information urgency level
5. Specific needs: Explicitly stated requirements
6. Implicit requirements: Unstated but inferred needs

Output in JSON format:
{
  "primaryGoal": "Brief description of primary goal",
  "context": "Assumed context/background",
  "userType": "Assumed user type",
  "urgency": "Urgency level",
  "specificNeeds": ["specific need 1", "specific need 2"],
  "implicitRequirements": ["implicit requirement 1", "implicit requirement 2"]
}`
    };

    return prompts[language as keyof typeof prompts] || prompts.ja;
  }

  /**
   * 意図に基づいて包括的な検索戦略を立案
   */
  private async formulateSearchStrategy(
    userQuery: string,
    intent: any,
    language: SupportedLanguage
  ): Promise<SearchStrategy> {
    const prompt = this.buildStrategyFormulationPrompt(userQuery, intent, language);
    const response = await this.geminiService.generateText(prompt, undefined, language);
    
    // 安全なJSON解析
    return safeJsonParse(response, this.createFallbackStrategy(userQuery));
  }

  private buildStrategyFormulationPrompt(
    userQuery: string,
    intent: any,
    language: SupportedLanguage
  ): string {
    const prompts = {
      ja: `
以下の情報に基づいて、東京都オープンデータを効果的に検索するための戦略を立案してください。

【ユーザーの質問】: "${userQuery}"

【意図分析結果】:
- 主要目標: ${intent.primaryGoal}
- 文脈: ${intent.context}
- ユーザータイプ: ${intent.userType}
- 緊急度: ${intent.urgency}
- 具体的ニーズ: ${intent.specificNeeds.join(', ')}
- 暗黙の要求: ${intent.implicitRequirements.join(', ')}

【利用可能なデータ分野】:
子育て・教育、福祉・医療、環境・エネルギー、交通・インフラ、防災・安全、
経済・産業、観光・文化、住宅・都市計画、統計、行政情報

【戦略立案指針】:
1. 複数の角度からアプローチ（直接的キーワード + 関連概念 + 上位・下位概念）
2. 段階的検索（幅広い検索 → 絞り込み → 詳細検索）
3. 検索結果の評価基準設定
4. 代替検索キーワードの準備

以下のJSON形式で戦略を出力してください：
{
  "goal": "検索の最終目標",
  "approach": "アプローチ手法の説明",
  "keywordSets": [
    {
      "primary": ["主要キーワード1", "主要キーワード2"],
      "related": ["関連語1", "関連語2"],
      "concepts": ["概念1", "概念2"]
    }
  ],
  "searchPhases": [
    {
      "name": "フェーズ1名",
      "keywords": ["検索語1", "検索語2"],
      "filters": {
        "categories": ["カテゴリ1"],
        "organizations": ["組織1"],
        "tags": ["タグ1"]
      }
    }
  ],
  "evaluation_criteria": ["評価基準1", "評価基準2"]
}`,
      en: `
Formulate a strategy to effectively search Tokyo Open Data based on the following information.

User question: "${userQuery}"

Intent analysis:
- Primary goal: ${intent.primaryGoal}
- Context: ${intent.context}
- User type: ${intent.userType}
- Urgency: ${intent.urgency}
- Specific needs: ${intent.specificNeeds.join(', ')}
- Implicit requirements: ${intent.implicitRequirements.join(', ')}

Available data categories:
Childcare/Education, Welfare/Medical, Environment/Energy, Transportation/Infrastructure,
Disaster Prevention/Safety, Economy/Industry, Tourism/Culture, Housing/Urban Planning,
Statistics, Administrative Information

Output strategy in JSON format:
{
  "goal": "Final search objective",
  "approach": "Approach methodology",
  "keywordSets": [...],
  "searchPhases": [...],
  "evaluation_criteria": [...]
}`
    };

    return prompts[language as keyof typeof prompts] || prompts.ja;
  }

  /**
   * 戦略に基づいて多段階検索を実行
   */
  private async executeSearchStrategy(
    strategy: SearchStrategy,
    originalQuery: string,
    language: SupportedLanguage
  ): Promise<SearchResult> {
    const executionLog: Array<{
      phase: string;
      query: string;
      results: number;
      effectiveness: number;
      insights: string;
    }> = [];

    const allItems: OpenDataItem[] = [];
    const seenIds = new Set<string>();

    for (const phase of strategy.searchPhases) {
      try {
        log.info(`Executing search phase: ${phase.name}`);

        // 検索パラメータを構築
        const searchParams = {
          keywords: phase.keywords,
          categories: phase.filters.categories || [],
          organizations: phase.filters.organizations || [],
          tags: phase.filters.tags || []
        };

        // データ検索を実行
        const phaseItems = await this.dataService.fetchRelevantData(
          phase.keywords.join(' '),
          language
        );

        // 重複除去
        const newItems = phaseItems.filter(item => {
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        });

        allItems.push(...newItems);

        // 効果性を評価
        const effectiveness = await this.evaluatePhaseEffectiveness(
          newItems,
          originalQuery,
          phase.name,
          language
        );

        executionLog.push({
          phase: phase.name,
          query: phase.keywords.join(' '),
          results: newItems.length,
          effectiveness,
          insights: `Found ${newItems.length} new items, effectiveness: ${effectiveness.toFixed(2)}`
        });

        log.debug(`Phase ${phase.name} completed`, {
          newItems: newItems.length,
          totalItems: allItems.length,
          effectiveness
        });

      } catch (error) {
        log.warn(`Search phase ${phase.name} failed`, {
          error: (error as Error).message
        });

        executionLog.push({
          phase: phase.name,
          query: phase.keywords.join(' '),
          results: 0,
          effectiveness: 0,
          insights: `Phase failed: ${(error as Error).message}`
        });
      }
    }

    // 全体の信頼度を計算
    const avgEffectiveness = executionLog.reduce((sum, log) => sum + log.effectiveness, 0) / executionLog.length;
    const confidence = Math.min(0.9, avgEffectiveness * (allItems.length > 0 ? 1.0 : 0.5));

    return {
      items: allItems,
      strategy,
      executionLog,
      confidence,
      recommendations: await this.generateRecommendations(allItems, strategy, originalQuery, language)
    };
  }

  /**
   * フェーズの効果性を評価
   */
  private async evaluatePhaseEffectiveness(
    items: OpenDataItem[],
    originalQuery: string,
    phaseName: string,
    language: SupportedLanguage
  ): Promise<number> {
    if (items.length === 0) return 0;

    try {
      const prompt = this.buildEffectivenessEvaluationPrompt(
        items.slice(0, 3), // 評価負荷軽減のため上位3件のみ
        originalQuery,
        phaseName,
        language
      );

      const response = await this.geminiService.generateText(prompt, undefined, language);
      
      // 安全なJSON解析
      const evaluation = safeJsonParse(response, {
        effectiveness: Math.min(1, items.length / 5)
      });
      
      return Math.max(0, Math.min(1, evaluation.effectiveness || 0.5));
    } catch {
      // フォールバック: 結果数に基づく簡易評価
      return Math.min(1, items.length / 5);
    }
  }

  private buildEffectivenessEvaluationPrompt(
    items: OpenDataItem[],
    originalQuery: string,
    phaseName: string,
    language: SupportedLanguage
  ): string {
    const prompts = {
      ja: `
検索フェーズ「${phaseName}」の効果性を評価してください。

【元の質問】: "${originalQuery}"

【検索結果】:
${items.map((item, i) => 
  `${i + 1}. ${item.title}\n説明: ${item.description}\nカテゴリ: ${item.category}`
).join('\n\n')}

【評価基準】:
- 関連性: 元の質問への直接的な関連度
- 有用性: ユーザーにとっての実用価値
- 完全性: 質問に対する回答の完全さ

0.0〜1.0のスコアで評価し、以下の形式で出力してください：
{
  "effectiveness": 0.85,
  "reasoning": "評価理由",
  "relevance_score": 0.9,
  "usefulness_score": 0.8,
  "completeness_score": 0.8
}`,
      en: `
Evaluate the effectiveness of search phase "${phaseName}".

Original question: "${originalQuery}"

Search results:
${items.map((item, i) => 
  `${i + 1}. ${item.title}\nDescription: ${item.description}\nCategory: ${item.category}`
).join('\n\n')}

Evaluation criteria:
- Relevance: Direct relevance to original question
- Usefulness: Practical value to user
- Completeness: Completeness of answer to question

Rate 0.0-1.0 and output in this format:
{
  "effectiveness": 0.85,
  "reasoning": "evaluation reason",
  "relevance_score": 0.9,
  "usefulness_score": 0.8,
  "completeness_score": 0.8
}`
    };

    return prompts[language as keyof typeof prompts] || prompts.ja;
  }

  /**
   * 結果を評価し、必要に応じて追加検索を実行
   */
  private async evaluateAndRefineResults(
    result: SearchResult,
    originalQuery: string,
    language: SupportedLanguage
  ): Promise<SearchResult> {
    // 信頼度が低い場合は追加検索を検討
    if (result.confidence < 0.6 && result.items.length < 3) {
      log.info('Low confidence detected, attempting refinement search');

      try {
        // より広範囲な検索を実行
        const refinementItems = await this.executeRefinementSearch(
          originalQuery,
          result,
          language
        );

        if (refinementItems.length > 0) {
          // 重複除去
          const existingIds = new Set(result.items.map(item => item.id));
          const newItems = refinementItems.filter(item => !existingIds.has(item.id));

          result.items.push(...newItems);
          result.confidence = Math.min(0.8, result.confidence + 0.2);
          result.executionLog.push({
            phase: 'refinement',
            query: 'broad_search',
            results: newItems.length,
            effectiveness: 0.7,
            insights: `Added ${newItems.length} items through refinement search`
          });
        }
      } catch (error) {
        log.warn('Refinement search failed', { error: (error as Error).message });
      }
    }

    return result;
  }

  /**
   * 改善検索を実行
   */
  private async executeRefinementSearch(
    originalQuery: string,
    currentResult: SearchResult,
    language: SupportedLanguage
  ): Promise<OpenDataItem[]> {
    // より基本的で広範囲なキーワードで検索
    const basicKeywords = this.extractBasicConcepts(originalQuery);
    
    const refinementItems: OpenDataItem[] = [];
    
    for (const keyword of basicKeywords.slice(0, 3)) {
      try {
        const items = await this.dataService.fetchRelevantData(keyword, language);
        refinementItems.push(...items.slice(0, 2)); // 各キーワードから最大2件
      } catch (error) {
        log.warn(`Refinement search failed for keyword: ${keyword}`, {
          error: (error as Error).message
        });
      }
    }

    return refinementItems;
  }

  private extractBasicConcepts(query: string): string[] {
    // 基本概念マッピング
    const conceptMap: { [key: string]: string[] } = {
      '保育': ['子育て', '育児支援', '児童'],
      '医療': ['病院', '健康', '医療機関'],
      '高齢者': ['介護', '福祉', 'シニア'],
      '環境': ['環境保護', 'エコ', '環境対策'],
      '防災': ['災害', '避難', '安全'],
      '交通': ['電車', 'バス', '道路'],
      '教育': ['学校', '学習', '教育機関'],
      '住宅': ['住居', '不動産', '住宅支援']
    };

    const concepts: string[] = [];
    const queryLower = query.toLowerCase();

    for (const [key, relatedTerms] of Object.entries(conceptMap)) {
      if (queryLower.includes(key)) {
        concepts.push(key, ...relatedTerms);
      }
    }

    // フォールバック: 質問から基本的な名詞を抽出
    if (concepts.length === 0) {
      const basicNouns = query
        .replace(/[？?！!。、，,．.]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1)
        .filter(word => !['について', 'に関して', 'を教えて', 'ください'].includes(word))
        .slice(0, 3);
      
      concepts.push(...basicNouns);
    }

    return [...new Set(concepts)]; // 重複除去
  }

  /**
   * 推奨事項を生成
   */
  private async generateRecommendations(
    items: OpenDataItem[],
    strategy: SearchStrategy,
    originalQuery: string,
    language: SupportedLanguage
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (items.length === 0) {
      recommendations.push(
        language === 'ja' 
          ? 'より具体的なキーワードで検索してみてください'
          : 'Try searching with more specific keywords'
      );
    } else if (items.length < 3) {
      recommendations.push(
        language === 'ja'
          ? '関連する分野も含めて検索してみてください'
          : 'Try including related fields in your search'
      );
    }

    if (strategy.keywordSets.length > 0) {
      const alternativeKeywords = strategy.keywordSets[0].related.slice(0, 2);
      if (alternativeKeywords.length > 0) {
        recommendations.push(
          language === 'ja'
            ? `「${alternativeKeywords.join('」や「')}」でも検索可能です`
            : `You can also search with "${alternativeKeywords.join('" or "')}"`
        );
      }
    }

    return recommendations;
  }

  private createFallbackStrategy(userQuery: string): SearchStrategy {
    return {
      goal: 'Basic keyword search',
      approach: 'Fallback to simple keyword extraction',
      keywordSets: [{
        primary: [userQuery],
        related: [],
        concepts: []
      }],
      searchPhases: [{
        name: 'fallback',
        keywords: [userQuery],
        filters: {}
      }],
      evaluation_criteria: ['result_count']
    };
  }
}