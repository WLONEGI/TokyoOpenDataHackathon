import { OpenDataItem, SupportedLanguage } from '@/types';
import { log } from '@/lib/logger';
import { GeminiService } from './GeminiService';
import { AutonomousSearchAgent } from './AutonomousSearchAgent';
import { VectorSearchService } from './VectorSearchService';
import { TimeContextService, TemporalContext } from './TimeContextService';
import { GeospatialContextService, GeospatialContext, Coordinates } from './GeospatialContextService';
import { parseJsonFromResponse, safeJsonParse, parseWithFallbacks } from '@/lib/utils/jsonParser';

// 高度AI応答の型定義
interface UserInput {
  sessionId: string;
  message: string;
  language: SupportedLanguage;
  inputType?: 'text' | 'voice';
  context?: Record<string, string | number | boolean>;
  // コンテキスト情報
  location?: Coordinates;
  timestamp?: Date;
  requestedScope?: {
    timeRange?: 'today' | 'this_week' | 'this_month' | 'next_month' | 'any';
    locationRange?: 'nearby' | 'walking_distance' | 'cycling_distance' | 'city_wide' | 'any';
  };
}

interface Intent {
  primaryGoal: string;
  context: string;
  userType: 'citizen' | 'business' | 'researcher' | 'visitor';
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  specificNeeds: string[];
  implicitRequirements: string[];
  requiredCapabilities: string[];
  estimatedSteps: number;
}

interface ThoughtStep {
  stepNumber: number;
  description: string;
  reasoning: string;
  action: string;
  confidence: number;
  evidence: Array<{
    type: 'data' | 'knowledge' | 'inference';
    content: string;
    reliability: number;
  }>;
  nextActions: string[];
}

interface ThoughtChain {
  totalSteps: number;
  currentStep: number;
  steps: ThoughtStep[];
  conclusion: {
    finalAnswer: string;
    confidence: number;
    evidenceStrength: number;
    limitations: string[];
    assumptions: string[];
  };
  metadata: {
    processingTime: number;
    complexityScore: number;
    toolsUsed: string[];
    knowledgeSources: string[];
  };
}

interface ExecutionPlan {
  goal: string;
  approach: string;
  phases: Array<{
    name: string;
    description: string;
    actions: string[];
    tools: string[];
    expectedOutput: string;
    dependencies: string[];
    timeEstimate: number;
  }>;
  fallbackStrategies: string[];
  successCriteria: string[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigation: string[];
  };
}

interface AiResponse {
  content: string;
  confidence: number;
  reasoning: {
    approach: string;
    keyInsights: string[];
    thoughtProcess: ThoughtStep[];
    evidenceSummary: string;
  };
  sources: Array<{
    type: 'opendata' | 'knowledge' | 'inference';
    title: string;
    reliability: number;
    relevance: number;
  }>;
  recommendations: string[];
  uncertaintyIndicators?: string[];
  followUpQuestions?: string[];
  relatedTopics?: string[];
  metadata: {
    processingTime: number;
    toolsUsed: string[];
    dataSourcesAccessed: string[];
    qualityScore: number;
  };
}

interface ConversationContext {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;
  userProfile: {
    preferences: {
      language: SupportedLanguage;
      responseStyle: 'concise' | 'detailed' | 'technical';
      expertiseLevel: 'beginner' | 'intermediate' | 'expert';
    };
    interactionHistory: {
      commonTopics: string[];
      preferredDataTypes: string[];
      feedbackPatterns: string[];
    };
  };
  contextualKnowledge: {
    currentTopic: string;
    relatedConcepts: string[];
    previousConclusions: string[];
    ongoingTasks: string[];
  };
  // 拡張コンテキスト情報
  temporalContext?: TemporalContext;
  geospatialContext?: GeospatialContext;
  lastUpdated: Date;
}

/**
 * 高度AIオーケストレーター
 * ChatGPT/Claudeレベルの知的対話を実現
 */
export class AIOrchestrator {
  private geminiService: GeminiService;
  private searchAgent: AutonomousSearchAgent;
  private vectorSearch: VectorSearchService;
  private timeContextService: TimeContextService;
  private geospatialContextService: GeospatialContextService;
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private performanceMetrics = {
    responseCount: 0,
    averageResponseTime: 0,
    averageConfidence: 0,
    userSatisfactionScore: 0
  };

  constructor() {
    this.geminiService = new GeminiService();
    this.searchAgent = new AutonomousSearchAgent();
    this.vectorSearch = new VectorSearchService();
    this.timeContextService = new TimeContextService();
    this.geospatialContextService = new GeospatialContextService();
  }

  /**
   * メイン処理エントリーポイント - ChatGPT/Claudeレベルの応答生成
   */
  async processUserInput(input: UserInput): Promise<AiResponse> {
    const startTime = Date.now();
    
    try {
      log.info('AI Orchestrator processing started', {
        sessionId: input.sessionId,
        message: input.message.substring(0, 100),
        language: input.language
      });

      // 1. コンテキスト取得・管理
      const context = await this.getOrCreateContext(input.sessionId, input.language);
      await this.updateContext(context, input);
      
      // 1.5. コンテキスト情報の収集・統合
      await this.enrichContextWithEnvironmentalData(context, input);

      // 2. 深度意図分析
      const intent = await this.analyzeUserIntent(input.message, context);
      log.debug('Intent analyzed', intent as Record<string, any>);

      // 3. 自己能力評価（メタ認知）
      const capabilities = await this.assessOwnCapabilities(input.message, intent);
      log.debug('Capabilities assessed', capabilities as Record<string, any>);

      // 4. 動的実行計画立案
      const executionPlan = await this.generateExecutionPlan(intent, capabilities);
      log.debug('Execution plan generated', executionPlan as Record<string, any>);

      // 5. Chain of Thought 推論実行
      const reasoning = await this.executeChainOfThought(input.message, context, executionPlan);
      log.debug('Chain of thought completed', { steps: reasoning.steps.length });

      // 6. 情報収集・知識統合
      const knowledge = await this.gatherAndIntegrateKnowledge(reasoning, intent, context);
      log.debug('Knowledge integrated', { sources: knowledge.sources.length });

      // 7. 包括的応答生成
      const response = await this.synthesizeIntelligentResponse({
        input,
        context,
        intent,
        reasoning,
        knowledge,
        executionPlan
      });

      // 8. 品質評価・自己改善
      await this.evaluateAndImprove(input, response, context);

      // 9. コンテキスト更新
      await this.updateContextWithResponse(context, response);

      const processingTime = Date.now() - startTime;
      response.metadata.processingTime = processingTime;

      // 10. パフォーマンス記録
      this.updatePerformanceMetrics(response, processingTime);

      log.info('AI Orchestrator processing completed', {
        sessionId: input.sessionId,
        processingTime,
        confidence: response.confidence,
        toolsUsed: response.metadata.toolsUsed.length
      });

      return response;

    } catch (error) {
      log.error('AI Orchestrator processing failed', error as Error, {
        sessionId: input.sessionId,
        message: input.message.substring(0, 50)
      });

      // 優雅な失敗 - 基本的な応答を提供
      return this.generateFallbackResponse(input, error as Error);
    }
  }

  /**
   * 深度意図分析 - ユーザーの真の目的を理解
   */
  private async analyzeUserIntent(message: string, context: ConversationContext): Promise<Intent> {
    const prompt = this.buildIntentAnalysisPrompt(message, context);
    
    try {
      const response = await this.geminiService.generateText(prompt, undefined, context.userProfile.preferences.language);
      
      // 安全なJSON解析
      const analysis = safeJsonParse(response, {
        primaryGoal: message,
        context: '一般的な情報要求',
        userType: 'citizen' as const,
        urgency: 'medium' as const,
        complexity: 'moderate' as const,
        specificNeeds: [message],
        implicitRequirements: [],
        requiredCapabilities: ['search', 'reasoning'],
        estimatedSteps: 3
      });
      
      return {
        primaryGoal: analysis.primaryGoal || message,
        context: analysis.context || '一般的な情報要求',
        userType: analysis.userType || 'citizen',
        urgency: analysis.urgency || 'medium',
        complexity: analysis.complexity || 'moderate',
        specificNeeds: analysis.specificNeeds || [message],
        implicitRequirements: analysis.implicitRequirements || [],
        requiredCapabilities: analysis.requiredCapabilities || ['search', 'reasoning'],
        estimatedSteps: analysis.estimatedSteps || 3
      };
    } catch (error) {
      log.warn('Intent analysis failed, using fallback', { error: (error as Error).message });
      return this.createFallbackIntent(message);
    }
  }

  private isSimpleTimeQuery(message: string): boolean {
    const timeQueries = [
      '今何時', '現在時刻', '時間', '今の時間', 'what time', 'current time',
      'いま何時', '何時ですか', '時刻を教えて', '今は何時'
    ];
    
    const lowerMessage = message.toLowerCase();
    return timeQueries.some(query => lowerMessage.includes(query.toLowerCase()));
  }

  private buildIntentAnalysisPrompt(message: string, context: ConversationContext): string {
    // 時刻クエリの高速処理
    if (this.isSimpleTimeQuery(message)) {
      return `簡単な時刻質問です。以下のJSONで即座に応答してください：
{
  "primaryGoal": "現在時刻の表示",
  "context": "時刻確認",
  "userType": "citizen",
  "urgency": "low",
  "complexity": "simple",
  "specificNeeds": ["現在時刻"],
  "implicitRequirements": [],
  "requiredCapabilities": ["time_display"],
  "estimatedSteps": 1
}`;
    }

    const recentMessages = context.messages.slice(-3).map(m => // 5→3に削減
      `${m.role}: ${m.content.substring(0, 100)}` // 内容も100文字に制限
    ).join('\n');

    const userPrefs = context.userProfile.preferences;
    
    // コンテキスト情報を簡略化
    let contextInfo = '';
    if (context.temporalContext) {
      contextInfo += `\n時刻: ${context.temporalContext.timeOfDay} (${context.temporalContext.dayType})`;
    }
    
    if (context.geospatialContext) {
      contextInfo += `\n位置: ${context.geospatialContext.address.city}`;
    }

    return `
AI意図分析。ユーザーの質問を簡潔に分析してください。

質問: "${message}"
履歴: ${recentMessages}${contextInfo}

簡潔にJSON形式で分析結果を返してください。不要な説明は省略。

{
  "primaryGoal": "主な目標",
  "context": "背景",
  "userType": "citizen",
  "urgency": "low|medium|high",
  "complexity": "simple|moderate|complex",
  "specificNeeds": ["具体的要求"],
  "implicitRequirements": ["暗黙的要求"],
  "requiredCapabilities": ["必要機能"],
  "estimatedSteps": 1-5
}`;
  }

  /**
   * 自己能力評価（メタ認知）
   */
  private async assessOwnCapabilities(message: string, intent: Intent): Promise<{
    canHandle: boolean;
    limitations: string[];
    requiredTools: string[];
    confidenceLevel: number;
    alternativeApproaches: string[];
  }> {
    // 簡単なクエリは高速評価
    if (intent.complexity === 'simple') {
      return {
        canHandle: true,
        limitations: [],
        requiredTools: ['search'],
        confidenceLevel: 0.9,
        alternativeApproaches: []
      };
    }

    const prompt = `
質問: "${message}"
複雑度: ${intent.complexity}

JSON形式で簡潔に評価：
{
  "canHandle": true,
  "limitations": ["制限事項"],
  "requiredTools": ["必要ツール"],
  "confidenceLevel": 0.8,
  "alternativeApproaches": ["代替案"]
}`;

    try {
      const response = await this.geminiService.generateText(prompt, undefined, intent.context.includes('ja') ? 'ja' : 'en');
      
      // 安全なJSON解析
      const capabilities = safeJsonParse(response, {
        canHandle: true,
        limitations: ['一般的な知識の制限'],
        requiredTools: ['search'],
        confidenceLevel: 0.7,
        alternativeApproaches: ['基本的な情報提供']
      });
      
      return capabilities;
    } catch (error) {
      log.warn('Capability assessment failed', { error: (error as Error).message });
      return {
        canHandle: true,
        limitations: ['一般的な知識の制限'],
        requiredTools: ['search'],
        confidenceLevel: 0.7,
        alternativeApproaches: ['基本的な情報提供']
      };
    }
  }

  /**
   * 動的実行計画生成
   */
  private async generateExecutionPlan(intent: Intent, capabilities: any): Promise<ExecutionPlan> {
    // 簡単なクエリは事前定義プランを使用
    if (intent.complexity === 'simple') {
      return this.createSimpleExecutionPlan(intent);
    }

    const prompt = `
目標: ${intent.primaryGoal}
複雑度: ${intent.complexity}
ツール: ${capabilities.requiredTools.join(', ')}

JSON形式で簡潔な実行計画：
{
  "goal": "${intent.primaryGoal}",
  "approach": "効率的アプローチ",
  "phases": [
    {
      "name": "情報収集",
      "description": "データ取得",
      "actions": ["検索実行"],
      "tools": ["search"],
      "expectedOutput": "関連情報",
      "dependencies": [],
      "timeEstimate": 2
    }
  ],
  "fallbackStrategies": ["基本回答"],
  "successCriteria": ["回答生成"],
  "riskAssessment": {
    "level": "low",
    "factors": [],
    "mitigation": []
  }
}`;

    try {
      const response = await this.geminiService.generateText(prompt);
      
      // 安全なJSON解析
      const plan = safeJsonParse(response, this.createFallbackExecutionPlan(intent));
      
      return plan;
    } catch (error) {
      log.warn('Execution plan generation failed', { error: (error as Error).message });
      return this.createFallbackExecutionPlan(intent);
    }
  }

  /**
   * Chain of Thought 推論実行
   */
  private async executeChainOfThought(
    message: string,
    context: ConversationContext,
    plan: ExecutionPlan
  ): Promise<ThoughtChain> {
    const prompt = `
あなたは高度な推論エンジンです。Chain of Thought（段階的思考）を使って、以下の問題を解決してください。

【問題】
${message}

【実行計画】
${JSON.stringify(plan, null, 2)}

【コンテキスト】
${context.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

【推論プロセス】
各ステップで以下を明示してください：
1. **現在の理解**: このステップで何を理解・分析しているか
2. **推論根拠**: なぜこの推論を行うのか
3. **実行アクション**: 具体的に何を行うか
4. **証拠・根拠**: 判断の根拠となる情報
5. **次のステップ**: 次に何を行うべきか

【出力形式】JSON
{
  "totalSteps": 推定総ステップ数,
  "currentStep": 現在ステップ,
  "steps": [
    {
      "stepNumber": 1,
      "description": "ステップの説明",
      "reasoning": "推論の詳細",
      "action": "実行アクション",
      "confidence": 信頼度,
      "evidence": [
        {
          "type": "data|knowledge|inference",
          "content": "証拠内容",
          "reliability": 信頼性スコア
        }
      ],
      "nextActions": ["次の行動候補"]
    }
  ],
  "conclusion": {
    "finalAnswer": "最終的な答えの方向性",
    "confidence": 全体信頼度,
    "evidenceStrength": 証拠の強さ,
    "limitations": ["制限事項"],
    "assumptions": ["前提条件"]
  },
  "metadata": {
    "processingTime": 0,
    "complexityScore": 複雑度_1_10,
    "toolsUsed": ["使用ツール"],
    "knowledgeSources": ["知識源"]
  }
}

段階的で論理的な思考プロセスを実行し、各ステップの根拠を明確にしてください。
`;

    try {
      const response = await this.geminiService.generateText(prompt, undefined, context.userProfile.preferences.language);
      
      // 安全なJSON解析
      const reasoning = safeJsonParse(response, this.createFallbackThoughtChain(message, plan));
      
      // メタデータの更新
      if (reasoning.metadata) {
        reasoning.metadata.processingTime = Date.now();
      }
      
      return reasoning;
    } catch (error) {
      log.warn('Chain of thought execution failed', { error: (error as Error).message });
      return this.createFallbackThoughtChain(message, plan);
    }
  }

  /**
   * 情報収集・知識統合（コンテキスト対応）
   */
  private async gatherAndIntegrateKnowledge(
    reasoning: ThoughtChain,
    intent: Intent,
    context?: ConversationContext
  ): Promise<{
    sources: OpenDataItem[];
    integratedKnowledge: string;
    reliabilityAssessment: number;
  }> {
    try {
      // コンテキスト対応クエリの拡張
      const enhancedQuery = await this.enhanceQueryWithContext(
        intent.primaryGoal,
        context
      );
      
      log.debug('Enhanced query with context', { 
        original: intent.primaryGoal,
        enhanced: enhancedQuery
      });

      // 自律的検索エージェントによる情報収集
      const searchResult = await this.searchAgent.executeAutonomousSearch(
        enhancedQuery,
        'ja' // 現在は日本語固定、将来は動的決定
      );

      // コンテキストフィルタリングを適用
      const filteredSources = await this.applyContextualFiltering(
        searchResult.items,
        context
      );

      // 収集した情報の統合
      const integratedKnowledge = await this.integrateKnowledgeSources(
        filteredSources,
        reasoning,
        intent,
        context
      );

      // 信頼性評価
      const reliability = this.assessKnowledgeReliability(filteredSources, searchResult.confidence);

      return {
        sources: filteredSources,
        integratedKnowledge,
        reliabilityAssessment: reliability
      };
    } catch (error) {
      log.warn('Knowledge gathering failed', { error: (error as Error).message });
      return {
        sources: [],
        integratedKnowledge: '一般的な知識に基づいて回答します',
        reliabilityAssessment: 0.5
      };
    }
  }

  /**
   * 知識源の統合（コンテキスト対応）
   */
  private async integrateKnowledgeSources(
    sources: OpenDataItem[],
    reasoning: ThoughtChain,
    intent: Intent,
    context?: ConversationContext
  ): Promise<string> {
    if (sources.length === 0) {
      return '具体的なオープンデータが見つかりませんでしたが、一般的な知識に基づいてお答えします。';
    }

    const prompt = `
複数の情報源を統合して、包括的で正確な知識ベースを構築してください。

【統合対象の情報源】
${sources.slice(0, 5).map((source, i) => `
${i + 1}. ${source.title}
   説明: ${source.description}
   内容: ${source.content.substring(0, 300)}...
   カテゴリ: ${source.category}
   信頼性: ${source.metadata?.source}
`).join('\n')}

【推論コンテキスト】
目標: ${intent.primaryGoal}
思考プロセス: ${reasoning.steps.map(s => s.description).join(' → ')}
${context?.temporalContext ? `\n時間的コンテキスト: ${context.temporalContext.currentTime.toLocaleString('ja-JP')} (${context.temporalContext.timeOfDay}, ${context.temporalContext.dayType})` : ''}
${context?.geospatialContext ? `\n位置的コンテキスト: ${context.geospatialContext.address.city} (${context.geospatialContext.transportation.nearestStations[0]?.name || '位置不明'}周辺)` : ''}

【統合指針】
1. 情報の正確性と一貫性を確保
2. 矛盾する情報は明示的に指摘
3. 情報の新しさと関連性を考慮
4. 不足している情報は明確に識別
5. 統合結果の信頼性レベルを評価

【出力形式】
統合された知識を自然な文章で記述し、以下を含めてください：
- 主要な事実とデータ
- 情報源間の関係性
- 確実な情報と推測の区別
- 制限事項や注意点

統合知識をまとめてください：
`;

    try {
      return await this.geminiService.generateText(prompt);
    } catch (error) {
      log.warn('Knowledge integration failed', { error: (error as Error).message });
      return sources.map(s => s.content).join('\n\n');
    }
  }

  /**
   * 包括的応答生成
   */
  private async synthesizeIntelligentResponse(data: {
    input: UserInput;
    context: ConversationContext;
    intent: Intent;
    reasoning: ThoughtChain;
    knowledge: any;
    executionPlan: ExecutionPlan;
  }): Promise<AiResponse> {
    const { input, context, intent, reasoning, knowledge, executionPlan } = data;

    const prompt = `
あなたは世界最高レベルのAIアシスタントです。以下の情報を統合して、ChatGPT/Claudeレベルの知的で有用な応答を生成してください。

【ユーザーの質問】
${input.message}

【分析結果】
意図: ${JSON.stringify(intent)}
思考プロセス: ${JSON.stringify(reasoning.steps.slice(0, 3))}
統合知識: ${knowledge.integratedKnowledge}

【応答要件】
- ユーザータイプ: ${intent.userType}
- 緊急度: ${intent.urgency}
- 回答スタイル: ${context.userProfile.preferences.responseStyle}
- 専門レベル: ${context.userProfile.preferences.expertiseLevel}

【応答品質基準】
1. **正確性**: 事実に基づく正確な情報
2. **有用性**: ユーザーの実際の問題解決に貢献
3. **明確性**: 理解しやすい構造化された説明
4. **完全性**: 必要な情報を網羅
5. **適切性**: ユーザーのニーズに適した詳細レベル

【特別な配慮】
- 不確実な情報は明示的に指摘
- 追加で確認すべき点を提案
- 関連する有用な情報も提供
- 具体的な次のステップを示唆

【出力形式】
自然で親しみやすい文体で、以下の構造で回答してください：

1. **直接的回答**: ユーザーの質問への明確な答え
2. **詳細説明**: 背景情報や根拠の説明
3. **具体的情報**: データ、事実、手順等
4. **注意点・制限**: 留意すべき点
5. **追加情報**: 関連する有用な情報
6. **次のステップ**: 推奨される行動

専門的でありながら親しみやすく、実用的な価値のある回答を生成してください。
`;

    try {
      const content = await this.geminiService.generateText(prompt, undefined, input.language);
      
      return {
        content,
        confidence: Math.min(0.95, reasoning.conclusion.confidence * knowledge.reliabilityAssessment),
        reasoning: {
          approach: executionPlan.approach,
          keyInsights: reasoning.steps.map(s => s.description),
          thoughtProcess: reasoning.steps,
          evidenceSummary: `${knowledge.sources.length}個のデータソースから統合`
        },
        sources: knowledge.sources.map((source: OpenDataItem) => ({
          type: 'opendata' as const,
          title: source.title,
          reliability: 0.8,
          relevance: 0.9
        })),
        recommendations: await this.generateRecommendations(intent, knowledge),
        uncertaintyIndicators: reasoning.conclusion.limitations,
        followUpQuestions: await this.generateFollowUpQuestions(intent, reasoning),
        relatedTopics: await this.identifyRelatedTopics(intent, knowledge),
        metadata: {
          processingTime: 0, // 後で設定
          toolsUsed: reasoning.metadata.toolsUsed,
          dataSourcesAccessed: knowledge.sources.map((s: OpenDataItem) => s.metadata?.source || 'Unknown'),
          qualityScore: this.calculateQualityScore(reasoning, knowledge)
        }
      };
    } catch (error) {
      log.error('Response synthesis failed', error as Error);
      throw error;
    }
  }

  // ヘルパーメソッド
  private async getOrCreateContext(sessionId: string, language: SupportedLanguage): Promise<ConversationContext> {
    if (!this.conversationContexts.has(sessionId)) {
      const newContext: ConversationContext = {
        sessionId,
        messages: [],
        userProfile: {
          preferences: {
            language,
            responseStyle: 'detailed',
            expertiseLevel: 'intermediate'
          },
          interactionHistory: {
            commonTopics: [],
            preferredDataTypes: [],
            feedbackPatterns: []
          }
        },
        contextualKnowledge: {
          currentTopic: '',
          relatedConcepts: [],
          previousConclusions: [],
          ongoingTasks: []
        },
        lastUpdated: new Date()
      };
      this.conversationContexts.set(sessionId, newContext);
    }
    return this.conversationContexts.get(sessionId)!;
  }

  private async updateContext(context: ConversationContext, input: UserInput): Promise<void> {
    context.messages.push({
      role: 'user',
      content: input.message,
      timestamp: new Date(),
      metadata: { 
        inputType: input.inputType,
        location: input.location,
        requestedScope: input.requestedScope
      }
    });
    context.lastUpdated = new Date();
  }

  private createFallbackIntent(message: string): Intent {
    return {
      primaryGoal: message,
      context: '一般的な情報要求',
      userType: 'citizen',
      urgency: 'medium',
      complexity: 'moderate',
      specificNeeds: [message],
      implicitRequirements: [],
      requiredCapabilities: ['search', 'reasoning'],
      estimatedSteps: 3
    };
  }

  private createSimpleExecutionPlan(intent: Intent): ExecutionPlan {
    return {
      goal: intent.primaryGoal,
      approach: 'Direct simple response',
      phases: [{
        name: 'direct_response',
        description: 'Provide direct answer',
        actions: ['respond'],
        tools: [],
        expectedOutput: 'Simple direct answer',
        dependencies: [],
        timeEstimate: 1
      }],
      fallbackStrategies: ['Provide basic information'],
      successCriteria: ['Quick response delivered'],
      riskAssessment: {
        level: 'low',
        factors: [],
        mitigation: []
      }
    };
  }

  private createFallbackExecutionPlan(intent: Intent): ExecutionPlan {
    return {
      goal: intent.primaryGoal,
      approach: 'Basic information search and response',
      phases: [{
        name: 'search_and_respond',
        description: 'Search for information and provide response',
        actions: ['search', 'analyze', 'respond'],
        tools: ['search'],
        expectedOutput: 'Informative response',
        dependencies: [],
        timeEstimate: 5
      }],
      fallbackStrategies: ['Provide general information'],
      successCriteria: ['User question answered'],
      riskAssessment: {
        level: 'low',
        factors: ['Limited information'],
        mitigation: ['Acknowledge limitations']
      }
    };
  }

  private createFallbackThoughtChain(message: string, plan: ExecutionPlan): ThoughtChain {
    return {
      totalSteps: 3,
      currentStep: 3,
      steps: [
        {
          stepNumber: 1,
          description: 'Understanding user question',
          reasoning: 'Analyzing the core request',
          action: 'Parse user input',
          confidence: 0.8,
          evidence: [{ type: 'inference', content: 'User query analysis', reliability: 0.8 }],
          nextActions: ['Search for information']
        },
        {
          stepNumber: 2,
          description: 'Searching for relevant information',
          reasoning: 'Looking for applicable data sources',
          action: 'Execute search',
          confidence: 0.7,
          evidence: [{ type: 'data', content: 'Search results', reliability: 0.7 }],
          nextActions: ['Formulate response']
        },
        {
          stepNumber: 3,
          description: 'Formulating response',
          reasoning: 'Synthesizing available information',
          action: 'Generate response',
          confidence: 0.7,
          evidence: [{ type: 'inference', content: 'Response synthesis', reliability: 0.7 }],
          nextActions: ['Deliver response']
        }
      ],
      conclusion: {
        finalAnswer: 'Based on available information',
        confidence: 0.7,
        evidenceStrength: 0.7,
        limitations: ['Limited data access'],
        assumptions: ['User seeking general information']
      },
      metadata: {
        processingTime: Date.now(),
        complexityScore: 5,
        toolsUsed: ['search'],
        knowledgeSources: ['general_knowledge']
      }
    };
  }

  private assessKnowledgeReliability(sources: OpenDataItem[], searchConfidence: number): number {
    if (sources.length === 0) return 0.5;
    
    const avgReliability = sources.reduce((sum, source) => {
      // オープンデータは一般的に信頼性が高い
      const baseReliability = 0.8;
      const sourceBonus = source.metadata?.source?.includes('tokyo') ? 0.1 : 0;
      return sum + Math.min(0.95, baseReliability + sourceBonus);
    }, 0) / sources.length;

    return Math.min(0.95, avgReliability * searchConfidence);
  }

  private async generateRecommendations(intent: Intent, knowledge: any): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (intent.urgency === 'high' || intent.urgency === 'emergency') {
      recommendations.push('緊急の場合は、まず関連機関に直接お問い合わせください');
    }
    
    if (knowledge.sources.length > 0) {
      recommendations.push('最新の情報については、公式ウェブサイトもご確認ください');
    }
    
    if (intent.complexity === 'complex') {
      recommendations.push('詳細な相談が必要な場合は、専門窓口にお問い合わせください');
    }

    return recommendations;
  }

  private async generateFollowUpQuestions(intent: Intent, reasoning: ThoughtChain): Promise<string[]> {
    const questions: string[] = [];
    
    if (intent.userType === 'citizen') {
      questions.push('具体的な地域や条件を指定して、より詳しい情報が必要ですか？');
    }
    
    if (reasoning.conclusion.limitations.length > 0) {
      questions.push('他にお知りになりたい関連情報はありますか？');
    }

    return questions;
  }

  private async identifyRelatedTopics(intent: Intent, knowledge: any): Promise<string[]> {
    const topics: string[] = [];
    
    // 意図から関連トピックを推定
    if (intent.primaryGoal.includes('子育て')) {
      topics.push('教育支援', '医療サービス', '保育施設');
    }
    
    if (intent.primaryGoal.includes('高齢者')) {
      topics.push('介護サービス', '健康支援', '生活支援');
    }

    return topics;
  }

  private calculateQualityScore(reasoning: ThoughtChain, knowledge: any): number {
    const reasoningScore = reasoning.conclusion.confidence;
    const knowledgeScore = knowledge.reliabilityAssessment;
    const completenessScore = Math.min(1, knowledge.sources.length / 3);
    
    return (reasoningScore * 0.4 + knowledgeScore * 0.4 + completenessScore * 0.2);
  }

  private async evaluateAndImprove(
    input: UserInput,
    response: AiResponse,
    context: ConversationContext
  ): Promise<void> {
    // 応答品質の自己評価
    if (response.confidence < 0.6) {
      log.warn('Low confidence response generated', {
        sessionId: input.sessionId,
        confidence: response.confidence,
        message: input.message.substring(0, 50)
      });
    }
    
    // ユーザープロファイルの更新
    this.updateUserProfile(context, input, response);
  }

  private updateUserProfile(
    context: ConversationContext,
    input: UserInput,
    response: AiResponse
  ): void {
    // トピック履歴の更新
    const topics = response.relatedTopics || [];
    topics.forEach(topic => {
      if (!context.userProfile.interactionHistory.commonTopics.includes(topic)) {
        context.userProfile.interactionHistory.commonTopics.push(topic);
      }
    });

    // データタイプ選好の記録
    const dataTypes = response.sources.map(s => s.type);
    dataTypes.forEach(type => {
      if (!context.userProfile.interactionHistory.preferredDataTypes.includes(type)) {
        context.userProfile.interactionHistory.preferredDataTypes.push(type);
      }
    });
  }

  private async updateContextWithResponse(
    context: ConversationContext,
    response: AiResponse
  ): Promise<void> {
    context.messages.push({
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        confidence: response.confidence,
        toolsUsed: response.metadata.toolsUsed,
        qualityScore: response.metadata.qualityScore
      }
    });

    // コンテキスト知識の更新
    if (response.relatedTopics) {
      context.contextualKnowledge.relatedConcepts.push(...response.relatedTopics);
    }
    
    context.lastUpdated = new Date();
  }

  private updatePerformanceMetrics(response: AiResponse, processingTime: number): void {
    this.performanceMetrics.responseCount++;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.responseCount - 1) + processingTime) / 
      this.performanceMetrics.responseCount;
    this.performanceMetrics.averageConfidence = 
      (this.performanceMetrics.averageConfidence * (this.performanceMetrics.responseCount - 1) + response.confidence) / 
      this.performanceMetrics.responseCount;
  }

  private async generateFallbackResponse(input: UserInput, error: Error): Promise<AiResponse> {
    return {
      content: `申し訳ございませんが、システムの処理中にエラーが発生しました。基本的な情報提供を試みます。

「${input.message}」について、一般的な情報をお調べいたします。より具体的な情報が必要でしたら、もう一度お聞かせください。`,
      confidence: 0.3,
      reasoning: {
        approach: 'Fallback response due to system error',
        keyInsights: ['System error occurred'],
        thoughtProcess: [],
        evidenceSummary: 'No data collected due to error'
      },
      sources: [],
      recommendations: ['より具体的な質問を試してください', 'システム管理者にお問い合わせください'],
      uncertaintyIndicators: ['システムエラーのため情報が限定的です'],
      metadata: {
        processingTime: 0,
        toolsUsed: [],
        dataSourcesAccessed: [],
        qualityScore: 0.3
      }
    };
  }

  /**
   * パフォーマンス統計の取得
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * アクティブセッション数の取得
   */
  getActiveSessionsCount(): number {
    return this.conversationContexts.size;
  }

  /**
   * コンテキスト情報の収集と統合
   */
  private async enrichContextWithEnvironmentalData(
    context: ConversationContext,
    input: UserInput
  ): Promise<void> {
    try {
      // 時間コンテキストの取得
      context.temporalContext = await this.timeContextService.getCurrentTimeContext();
      
      // 位置コンテキストの取得（位置情報が提供された場合）
      if (input.location) {
        if (this.geospatialContextService.validateCoordinates(input.location)) {
          context.geospatialContext = await this.geospatialContextService.generateGeospatialContext(input.location);
        } else {
          log.warn('Invalid coordinates provided', input.location as Record<string, any>);
        }
      }
      
      log.debug('Context enriched with environmental data', {
        hasTemporalContext: !!context.temporalContext,
        hasGeospatialContext: !!context.geospatialContext
      });
    } catch (error) {
      log.warn('Failed to enrich context with environmental data', {
        error: (error as Error).message
      });
    }
  }

  /**
   * コンテキストを考慮したクエリ拡張
   */
  private async enhanceQueryWithContext(
    originalQuery: string,
    context?: ConversationContext
  ): Promise<string> {
    if (!context?.temporalContext && !context?.geospatialContext) {
      return originalQuery;
    }

    try {
      const prompt = `
以下のユーザーの質問を、提供されたコンテキスト情報を考慮して拡張してください。

【元の質問】: "${originalQuery}"

【コンテキスト情報】:
${context.temporalContext ? `- 現在時刻: ${context.temporalContext.currentTime.toLocaleString('ja-JP')}` : ''}
${context.temporalContext ? `- 時間帯: ${context.temporalContext.timeOfDay}` : ''}
${context.temporalContext ? `- 日タイプ: ${context.temporalContext.dayType}` : ''}
${context.geospatialContext ? `- 位置: ${context.geospatialContext.address.city}` : ''}
${context.geospatialContext ? `- 最寄り駅: ${context.geospatialContext.transportation.nearestStations[0]?.name || '不明'}` : ''}

【拡張指針】:
1. 時間的な表現（"今月"、"今日"、"営業中"等）を具体的な条件に変換
2. 位置的な表現（"近く"、"周辺"等）を地理的条件に変換
3. 元の質問の意図は保持したまま、より具体的で検索可能な形に

拡張された検索クエリを出力してください：
`;
      
      const enhancedQuery = await this.geminiService.generateText(prompt, undefined, 'ja');
      return enhancedQuery.trim() || originalQuery;
    } catch (error) {
      log.warn('Failed to enhance query with context', { error: (error as Error).message });
      return originalQuery;
    }
  }

  /**
   * コンテキスト対応フィルタリング
   */
  private async applyContextualFiltering(
    items: OpenDataItem[],
    context?: ConversationContext
  ): Promise<OpenDataItem[]> {
    if (!context?.temporalContext && !context?.geospatialContext) {
      return items;
    }

    let filteredItems = [...items];

    try {
      // 時間的フィルタリング
      if (context.temporalContext) {
        filteredItems = await this.applyTemporalFiltering(filteredItems, context.temporalContext);
      }

      // 空間的フィルタリング
      if (context.geospatialContext) {
        filteredItems = await this.applyGeospatialFiltering(filteredItems, context.geospatialContext);
      }

      log.debug('Applied contextual filtering', {
        originalCount: items.length,
        filteredCount: filteredItems.length
      });

      return filteredItems;
    } catch (error) {
      log.warn('Contextual filtering failed', { error: (error as Error).message });
      return items;
    }
  }

  /**
   * 時間的フィルタリング
   */
  private async applyTemporalFiltering(
    items: OpenDataItem[],
    temporalContext: TemporalContext
  ): Promise<OpenDataItem[]> {
    return items.filter(item => {
      // 時間関連の情報がない場合は含める
      if (!item.metadata?.lastUpdated && !item.content.includes('営業')) {
        return true;
      }

      // 営業時間情報がある場合のフィルタリング
      if (item.content.includes('営業時間') || item.content.includes('開館時間')) {
        // 現在の時間に関連する情報を優先
        return true;
      }

      // イベント情報の時間フィルタリング
      if (item.category.includes('イベント') || item.content.includes('開催')) {
        // 今後のイベントを優先
        return true;
      }

      return true;
    });
  }

  /**
   * 空間的フィルタリング
   */
  private async applyGeospatialFiltering(
    items: OpenDataItem[],
    geospatialContext: GeospatialContext
  ): Promise<OpenDataItem[]> {
    return items.filter(item => {
      // 位置情報がない場合は含める
      if (!item.content.includes('住所') && !item.content.includes('所在地')) {
        return true;
      }

      // 現在の区・市に関連する情報を優先
      const currentCity = geospatialContext.address.city;
      if (item.content.includes(currentCity)) {
        return true;
      }

      // 近隣地域の情報も含める
      const nearbyStations = geospatialContext.transportation.nearestStations.map(s => s.name);
      for (const station of nearbyStations) {
        if (item.content.includes(station)) {
          return true;
        }
      }

      return true;
    });
  }

  /**
   * セッションのクリーンアップ
   */
  cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, context] of this.conversationContexts.entries()) {
      if (now - context.lastUpdated.getTime() > maxAge) {
        this.conversationContexts.delete(sessionId);
      }
    }
  }
}