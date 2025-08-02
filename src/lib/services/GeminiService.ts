import { GoogleGenerativeAI } from '@google/generative-ai';
import { Language } from '@/types';

interface GenerativeResponse {
  content: string;
  confidence: number;
  processingTime: number;
}

interface ChatContext {
  userMessage: string;
  language: Language;
  sessionHistory?: string[];
}

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
  }

  // システムプロンプトの生成
  private generateSystemPrompt(language: Language): string {
    const prompts = {
      ja: `あなたは東京都公式の子育て支援AIアシスタントです。以下の役割を持っています：

【役割】
- 東京都の子育て・育児に関する情報を正確に提供する
- 保育園、児童手当、予防接種、相談窓口等の情報を案内する
- 親しみやすく、丁寧な言葉遣いで回答する
- 不明な点は正直に「分からない」と答え、適切な窓口を案内する

【回答の指針】
- 簡潔で分かりやすい回答を心がける
- 具体的な手続きや連絡先を可能な限り提供する
- 最新の情報については各区市町村への確認を促す
- 緊急時は適切な連絡先（119番、医療機関等）を案内する

【注意事項】
- 医療的なアドバイスは行わない
- 個人的な判断を求められた場合は専門窓口を案内する
- 確実でない情報は提供しない`,

      en: `You are an official AI assistant for childcare support in Tokyo. Your roles include:

【Roles】
- Provide accurate information about childcare and parenting in Tokyo
- Guide users about nurseries, child allowances, vaccinations, consultation services, etc.
- Respond in a friendly and polite manner
- Honestly say "I don't know" when uncertain and direct to appropriate offices

【Response Guidelines】
- Provide concise and easy-to-understand answers
- Include specific procedures and contact information when possible
- Encourage users to verify latest information with local municipal offices
- In emergencies, provide appropriate contact numbers (119, medical institutions, etc.)

【Important Notes】
- Do not provide medical advice
- For personal judgments, direct to specialist services
- Do not provide uncertain information`
    };

    return prompts[language];
  }

  // テキストベースのチャット応答生成
  async generateChatResponse(context: ChatContext): Promise<GenerativeResponse> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.generateSystemPrompt(context.language);
      
      // プロンプトの構築
      let fullPrompt = `${systemPrompt}\n\n`;
      
      // セッション履歴がある場合は追加
      if (context.sessionHistory && context.sessionHistory.length > 0) {
        fullPrompt += `【これまでの会話】\n${context.sessionHistory.join('\n')}\n\n`;
      }
      
      fullPrompt += `【ユーザーの質問】\n${context.userMessage}\n\n`;
      fullPrompt += `【回答】（${context.language === 'ja' ? '日本語' : 'English'}で回答してください）\n`;

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const content = response.text();

      // 信頼度の計算（簡易版）
      const confidence = this.calculateConfidence(content, context.userMessage);

      return {
        content: content.trim(),
        confidence,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      console.error('Gemini API error:', error);
      
      // フォールバック応答
      const fallbackMessage = context.language === 'ja' 
        ? '申し訳ございませんが、現在システムに一時的な問題が発生しています。しばらく経ってから再度お試しいただくか、直接区市町村の窓口にお問い合わせください。'
        : 'We apologize, but there is currently a temporary system issue. Please try again later or contact your local municipal office directly.';

      return {
        content: fallbackMessage,
        confidence: 0.1,
        processingTime: Date.now() - startTime,
      };
    }
  }

  // 音声認識テキストの修正
  async improveTranscript(transcript: string, language: Language): Promise<string> {
    try {
      const prompt = language === 'ja' 
        ? `以下の音声認識結果を、自然な日本語に修正してください。文脈を考慮し、適切な句読点を追加してください：\n\n${transcript}`
        : `Please improve the following speech recognition result to natural English. Consider the context and add appropriate punctuation:\n\n${transcript}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Transcript improvement error:', error);
      return transcript; // エラー時は元のテキストを返す
    }
  }

  // 信頼度計算（簡易版）
  private calculateConfidence(response: string, question: string): number {
    let confidence = 0.8; // ベース信頼度

    // 長すぎる応答は信頼度を下げる
    if (response.length > 1000) {
      confidence -= 0.1;
    }

    // 「分からない」「確認してください」等の表現がある場合
    const uncertaintyPhrases = [
      '分からない', '不明', '確認してください', '窓口にお問い合わせ',
      "don't know", "uncertain", "please check", "contact the office"
    ];
    
    const hasUncertainty = uncertaintyPhrases.some(phrase => 
      response.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (hasUncertainty) {
      confidence -= 0.2;
    }

    // 具体的な情報（電話番号、住所、手続き等）が含まれている場合
    const specificInfoPatterns = [
      /\d{2,4}-\d{2,4}-\d{4}/, // 電話番号
      /〒\d{3}-\d{4}/, // 郵便番号
      /申請書/, /手続き/, /窓口/, // 手続き関連
      /application/, /procedure/, /office/ // 英語版
    ];
    
    const hasSpecificInfo = specificInfoPatterns.some(pattern => 
      pattern.test(response)
    );
    
    if (hasSpecificInfo) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  // モデルのヘルスチェック
  async healthCheck(): Promise<{ status: string; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      const testPrompt = "Hello, please respond with 'OK' in one word.";
      const result = await this.model.generateContent(testPrompt);
      const response = await result.response;
      const text = response.text();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: text.toLowerCase().includes('ok') ? 'healthy' : 'degraded',
        responseTime,
      };
    } catch (error) {
      console.error('Gemini health check error:', error);
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
      };
    }
  }
}

export default new GeminiService();