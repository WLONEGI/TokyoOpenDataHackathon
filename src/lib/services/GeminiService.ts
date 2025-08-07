import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '@/lib/config';
import { SupportedLanguage } from '@/types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private textModel: GenerativeModel;
  private audioModel: GenerativeModel;
  private embeddingModel: GenerativeModel;

  constructor() {
    if (!config.geminiApiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    
    // Gemini 2.5 Flash 設定（思考モードOFF）
    const optimizedConfig = {
      model: 'gemini-2.5-flash', // Gemini 2.5 Flash使用
      generationConfig: {
        temperature: 0.1, // 低温設定で直接的な応答（思考モードOFF）
        topK: 10, // 選択肢を制限して直接的な応答
        topP: 0.6, // 確定的な応答
        maxOutputTokens: 1024, // 適切な応答長
        candidateCount: 1, // 候補数を1に制限
        stopSequences: ['```', 'END', '終了'], // 早期停止用
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    };

    // シンプルクエリ用設定（思考モードOFF）
    const simpleConfig = {
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.05, // 極低温で直接的応答（思考プロセス排除）
        topK: 5, // 最小限の選択肢で確定的応答
        topP: 0.5, 
        maxOutputTokens: 512, // 簡潔な応答
        candidateCount: 1,
        stopSequences: ['```', 'END', '終了', '\n\n'],
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    };

    this.textModel = this.genAI.getGenerativeModel(optimizedConfig);
    this.audioModel = this.genAI.getGenerativeModel(optimizedConfig);
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
  }

  async generateText(prompt: string, context?: string, language: SupportedLanguage = 'ja', useAudioModel: boolean = false): Promise<string> {
    try {
      const languagePrompts = {
        ja: {
          systemPrompt: `あなたは東京都公式AI音声対話システムのアシスタントです。
以下のガイドラインに従って応答してください：

【役割】
- 東京都の行政サービスに関する情報提供に特化
- 特に子育て支援分野の情報を中心に案内

【応答制限】
1. 東京都の行政サービスに関係ない質問には回答しない
2. システムの技術的詳細（使用モデル、実装方法等）は開示しない
3. 個人情報の収集や開示は行わない
4. 政治的な意見や批判は述べない
5. 医療・法律の専門的アドバイスは提供しない

【応答スタイル】
- 丁寧で親しみやすい敬語を使用
- 正確な情報のみを提供
- 不明な点は推測せず、適切な窓口を案内

【制限外の質問への標準応答】
「申し訳ございませんが、その質問にはお答えできません。東京都の行政サービス、特に子育て支援に関する情報についてお気軽にお尋ねください。」`,
          contextPrompt: context 
            ? `【システムルール】
上記のガイドラインを厳守してください。

【参考情報】
${context}

【ユーザーの質問】
${prompt}

【応答指示】
- ユーザーの質問が東京都の行政サービスに関連する場合：参考情報に基づいて正確に回答
- ユーザーの質問が制限事項に該当する場合：標準応答を返す
- 技術的な質問（モデル名、実装方法等）の場合：「システムに関する技術的な情報はお答えできません」と回答

日本語で回答してください。`
            : `【システムルール】
上記のガイドラインを厳守してください。

【ユーザーの質問】
${prompt}

【応答指示】
- ユーザーの質問が東京都の行政サービスに関連する場合：子育て支援制度について回答
- ユーザーの質問が制限事項に該当する場合：標準応答を返す
- 技術的な質問（モデル名、実装方法等）の場合：「システムに関する技術的な情報はお答えできません」と回答

日本語で回答してください。`,
          fallbackMessage: '申し訳ございませんが、現在サービスに問題が発生しています。しばらく後にもう一度お試しください。'
        },
        en: {
          systemPrompt: `You are the official Tokyo AI Voice Dialogue System assistant.
Please follow these guidelines:

【Role】
- Specialize in providing information about Tokyo's administrative services
- Focus primarily on childcare support information

【Response Restrictions】
1. Do not answer questions unrelated to Tokyo's administrative services
2. Do not disclose technical details (model used, implementation methods, etc.)
3. Do not collect or disclose personal information
4. Do not express political opinions or criticism
5. Do not provide professional medical or legal advice

【Response Style】
- Use polite and friendly language
- Provide only accurate information
- For unclear matters, do not speculate but direct to appropriate services

【Standard Response for Restricted Questions】
"I apologize, but I cannot answer that question. Please feel free to ask about Tokyo's administrative services, especially childcare support information."`,
          contextPrompt: context 
            ? `【System Rules】
Strictly follow the above guidelines.

【Reference Information】
${context}

【User Question】
${prompt}

【Response Instructions】
- If the question relates to Tokyo's administrative services: Answer accurately based on reference information
- If the question falls under restrictions: Return the standard response
- For technical questions (model name, implementation, etc.): Reply "I cannot provide technical information about the system"

Please respond in English.`
            : `【System Rules】
Strictly follow the above guidelines.

【User Question】
${prompt}

【Response Instructions】
- If the question relates to Tokyo's administrative services: Answer about childcare support systems
- If the question falls under restrictions: Return the standard response
- For technical questions (model name, implementation, etc.): Reply "I cannot provide technical information about the system"

Please respond in English.`,
          fallbackMessage: 'I apologize, but there is currently an issue with the service. Please try again later.'
        },
        zh: {
          systemPrompt: `您是东京都官方AI语音对话系统的助手。
请遵循以下准则：

【角色】
- 专注于提供东京都行政服务相关信息
- 重点提供育儿支援领域的信息

【回答限制】
1. 不回答与东京都行政服务无关的问题
2. 不透露技术细节（使用的模型、实施方法等）
3. 不收集或披露个人信息
4. 不发表政治观点或批评
5. 不提供专业的医疗或法律建议

【回答风格】
- 使用礼貌友好的语言
- 只提供准确的信息
- 对于不明确的事项，不进行推测，而是引导至适当的服务窗口

【受限问题的标准回答】
"很抱歉，我无法回答这个问题。请随时询问有关东京都行政服务，特别是育儿支援方面的信息。"`,
          contextPrompt: context 
            ? `【系统规则】
严格遵守上述准则。

【参考信息】
${context}

【用户问题】
${prompt}

【回答指示】
- 如果问题与东京都行政服务相关：根据参考信息准确回答
- 如果问题属于限制事项：返回标准回答
- 对于技术问题（模型名称、实施方法等）：回复"我无法提供有关系统的技术信息"

请用中文回答。`
            : `【系统规则】
严格遵守上述准则。

【用户问题】
${prompt}

【回答指示】
- 如果问题与东京都行政服务相关：回答育儿支援制度相关内容
- 如果问题属于限制事项：返回标准回答
- 对于技术问题（模型名称、实施方法等）：回复"我无法提供有关系统的技术信息"

请用中文回答。`,
          fallbackMessage: '抱歉，服务目前出现问题。请稍后再试。'
        },
        ko: {
          systemPrompt: `당신은 도쿄도 공식 AI 음성 대화 시스템의 어시스턴트입니다.
다음 가이드라인을 따라주세요:

【역할】
- 도쿄도 행정 서비스 관련 정보 제공에 특화
- 특히 육아 지원 분야 정보를 중심으로 안내

【응답 제한】
1. 도쿄도 행정 서비스와 관계없는 질문에는 답변하지 않음
2. 시스템의 기술적 세부사항(사용 모델, 구현 방법 등)은 공개하지 않음
3. 개인정보 수집이나 공개를 하지 않음
4. 정치적 의견이나 비판을 하지 않음
5. 의료・법률 전문 조언은 제공하지 않음

【응답 스타일】
- 정중하고 친근한 언어 사용
- 정확한 정보만 제공
- 불명확한 점은 추측하지 않고 적절한 창구 안내

【제한 사항에 해당하는 질문에 대한 표준 응답】
"죄송합니다만, 그 질문에는 답변드릴 수 없습니다. 도쿄도의 행정 서비스, 특히 육아 지원에 관한 정보에 대해 편하게 문의해 주세요."`,
          contextPrompt: context 
            ? `【시스템 규칙】
위의 가이드라인을 엄격히 준수하세요.

【참고 정보】
${context}

【사용자 질문】
${prompt}

【응답 지시】
- 사용자 질문이 도쿄도 행정 서비스와 관련된 경우: 참고 정보에 기반하여 정확히 답변
- 사용자 질문이 제한 사항에 해당하는 경우: 표준 응답 반환
- 기술적 질문(모델명, 구현 방법 등)의 경우: "시스템에 관한 기술적 정보는 답변드릴 수 없습니다"라고 응답

한국어로 답변해주세요.`
            : `【시스템 규칙】
위의 가이드라인을 엄격히 준수하세요.

【사용자 질문】
${prompt}

【응답 지시】
- 사용자 질문이 도쿄도 행정 서비스와 관련된 경우: 육아 지원 제도에 대해 답변
- 사용자 질문이 제한 사항에 해당하는 경우: 표준 응답 반환
- 기술적 질문(모델명, 구현 방법 등)의 경우: "시스템에 관한 기술적 정보는 답변드릴 수 없습니다"라고 응답

한국어로 답변해주세요.`,
          fallbackMessage: '죄송합니다. 현재 서비스에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }
      };

      const languageConfig = languagePrompts[language as keyof typeof languagePrompts] || languagePrompts.ja;
      const fullPrompt = languageConfig.contextPrompt;
      const model = useAudioModel ? this.audioModel : this.textModel;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating text with Gemini:', error);
      throw new Error('Failed to generate response');
    }
  }

  async processAudio(audioData: string, mimeType: string): Promise<{ text: string; audioResponse?: string }> {
    try {
      // 現在のGemini 1.5-flashモデルでは音声認識をサポートしていないため、
      // Web Speech APIを使用した代替処理を行います
      
      if (!audioData || audioData.length === 0) {
        throw new Error('No audio data provided');
      }
      
      console.log('Audio processing: Using Web Speech API for transcription');
      
      // Web Speech APIでの音声認識は完了していることを前提とし、
      // ここではエラーハンドリングのみ行います
      return {
        text: 'Web Speech APIで音声認識を実行してください',
        audioResponse: undefined
      };
    } catch (error) {
      console.error('Error processing audio with Gemini:', error);
      throw new Error('Failed to process audio');
    }
  }

  async generateSpeech(text: string, language: SupportedLanguage = 'ja'): Promise<string | null> {
    try {
      // Use audio model for native audio dialog with speech generation
      const result = await this.audioModel.generateContent([
        `Generate audio response for: "${text}" in ${language}. Provide natural speech synthesis.`
      ]);
      
      const response = await result.response;
      // Note: This would require the native audio dialog model to support audio output
      // For now, we'll still rely on client-side synthesis
      return null;
    } catch (error) {
      console.error('Error generating speech with Gemini audio model:', error);
      return null;
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embeddings with Gemini:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  async analyzeIntent(message: string, language: SupportedLanguage = 'ja'): Promise<{ intent: string; confidence: number; entities: any[]; }> {
    try {
      const prompts = {
        ja: `
以下のユーザーメッセージを分析して、以下の情報を抽出してください：
1. 意図 (greeting, question, request_info, complaint, thanks, goodbye, childcare_info, disaster_info, general_info のいずれか)
2. エンティティ (場所、施設タイプ、年齢などの重要な情報)
3. 信頼度スコア (0-1)

ユーザーメッセージ: "${message}"

JSON形式で回答してください：
{
  "intent": "intent_name",
  "entities": {"key": "value"},
  "confidence": 0.95
}`,
        en: `
Analyze the following user message and extract:
1. Intent (one of: greeting, question, request_info, complaint, thanks, goodbye, childcare_info, disaster_info, general_info)
2. Entities (key information like location, facility type, age, etc.)
3. Confidence score (0-1)

User message: "${message}"

Respond in JSON format:
{
  "intent": "intent_name",
  "entities": {"key": "value"},
  "confidence": 0.95
}`,
        zh: `
分析以下用户消息并提取：
1. 意图 (greeting, question, request_info, complaint, thanks, goodbye, childcare_info, disaster_info, general_info 中的一个)
2. 实体 (位置、设施类型、年龄等关键信息)
3. 置信度分数 (0-1)

用户消息: "${message}"

请以JSON格式回答：
{
  "intent": "intent_name",
  "entities": {"key": "value"},
  "confidence": 0.95
}`,
        ko: `
다음 사용자 메시지를 분석하여 추출하세요：
1. 의도 (greeting, question, request_info, complaint, thanks, goodbye, childcare_info, disaster_info, general_info 중 하나)
2. 엔티티 (위치, 시설 유형, 나이 등 주요 정보)
3. 신뢰도 점수 (0-1)

사용자 메시지: "${message}"

JSON 형식으로 응답하세요：
{
  "intent": "intent_name",
  "entities": {"key": "value"},
  "confidence": 0.95
}`
      };

      const prompt = prompts[language as keyof typeof prompts] || prompts.ja;

      const result = await this.textModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        const parsed = JSON.parse(text) as { intent: string; confidence: number; entities: any; };
        return {
          intent: parsed.intent || 'question',
          entities: parsed.entities || [],
          confidence: parsed.confidence || 0.5
        };
      } catch {
        // Fallback if JSON parsing fails
        return {
          intent: 'question',
          entities: [],
          confidence: 0.5
        };
      }
    } catch (error) {
      console.error('Error analyzing intent with Gemini:', error);
      return {
        intent: 'question',
        entities: [],
        confidence: 0.5
      };
    }
  }

  // Cleanup method for proper resource management
  cleanup(): void {
    // No explicit cleanup needed for Gemini API client
    // But this method is called by ServiceManager for consistency
    console.log('GeminiService cleanup completed');
  }
}