import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import RedisService from '@/lib/services/RedisService';
import GeminiService from '@/lib/services/GeminiService';
import { ChatRequest, ChatResponse, Language, DataSource } from '@/types';

// チャット処理 API
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = uuidv4();

  try {
    const body: ChatRequest = await request.json();
    const sessionId = request.headers.get('X-Session-ID') || body.sessionId;

    // バリデーション
    const validation = validateChatRequest(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
          details: validation.details,
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_INVALID',
          message: 'セッションIDが必要です',
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 400 });
    }

    // レート制限チェック
    const rateLimit = await RedisService.checkRateLimit(`session:${sessionId}`, 60, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'リクエスト回数の上限を超えました',
          details: {
            limit: 60,
            window: 60,
            retryAfter: rateLimit.resetTime - Math.floor(Date.now() / 1000),
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          'Retry-After': (rateLimit.resetTime - Math.floor(Date.now() / 1000)).toString(),
        },
      });
    }

    // セッション確認
    const sessionData = await RedisService.getSession(sessionId);
    if (!sessionData) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '指定されたセッションが見つかりません',
        },
        timestamp: new Date().toISOString(),
        requestId,
      }, { status: 404 });
    }

    // キャッシュチェック
    const cacheKey = generateCacheKey(body.message, body.language || 'ja');
    const cachedResponse = await RedisService.getCache(cacheKey);
    
    if (cachedResponse) {
      // キャッシュヒット時の応答
      return NextResponse.json({
        success: true,
        data: {
          ...cachedResponse,
          sessionId,
          metadata: {
            ...cachedResponse.metadata,
            processingTime: Date.now() - startTime,
            cached: true,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      });
    }

    // AI応答生成
    const aiResponse = await GeminiService.generateChatResponse({
      userMessage: body.message,
      language: body.language || 'ja',
      sessionHistory: [], // TODO: セッション履歴の実装
    });

    // 関連データソースの検索（模擬実装）
    const sources = await searchRelatedSources(body.message, body.language || 'ja');

    // 音声合成URL生成（オプション）
    let audioUrl: string | undefined;
    if (body.options?.includeAudio) {
      audioUrl = await generateAudioUrl(aiResponse.content, body.language || 'ja', sessionId);
    }

    // レスポンス構築
    const response: ChatResponse = {
      content: aiResponse.content,
      sessionId,
      audioUrl,
      sources,
      metadata: {
        processingTime: aiResponse.processingTime,
        confidence: aiResponse.confidence,
        language: body.language || 'ja',
      },
    };

    // キャッシュに保存（5分間）
    await RedisService.setCache(cacheKey, {
      content: response.content,
      sources: response.sources,
      metadata: {
        ...response.metadata,
        cached: false,
      },
    }, 300);

    // セッション最終アクセス時刻更新
    await RedisService.updateSessionAccess(sessionId);

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      requestId,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'チャット処理中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    }, { status: 500 });
  }
}

// バリデーション関数
function validateChatRequest(body: any): { success: boolean; error?: string; details?: any } {
  const errors: string[] = [];

  if (!body.message) {
    errors.push('Message is required');
  } else if (typeof body.message !== 'string') {
    errors.push('Message must be a string');
  } else if (body.message.length > 1000) {
    errors.push('Message is too long (max 1000 characters)');
  } else if (body.message.trim().length === 0) {
    errors.push('Message cannot be empty');
  }

  if (body.language && !['ja', 'en'].includes(body.language)) {
    errors.push('Unsupported language');
  }

  return {
    success: errors.length === 0,
    error: errors.join(', '),
    details: errors,
  };
}

// キャッシュキー生成
function generateCacheKey(message: string, language: Language): string {
  const crypto = require('crypto');
  const normalized = message.toLowerCase().trim();
  const hash = crypto
    .createHash('sha256')
    .update(`${normalized}:${language}`)
    .digest('hex');
  return `chat_response:${hash}`;
}

// 関連データソース検索（模擬実装）
async function searchRelatedSources(message: string, language: Language): Promise<DataSource[]> {
  // TODO: 実際のVector Searchの実装
  // 現在は模擬データを返す
  
  const mockSources: DataSource[] = [];
  
  // キーワードベースの簡易マッチング
  const keywords = {
    ja: {
      '保育園': {
        id: 'childcare_001',
        title: '認可保育園一覧',
        category: '保育サービス',
        score: 0.89,
        url: 'https://www.metro.tokyo.lg.jp/tosei/hodohappyo/press/2024/01/15/01.html',
      },
      '児童手当': {
        id: 'allowance_001',
        title: '児童手当制度について',
        category: '経済的支援',
        score: 0.92,
        url: 'https://www.metro.tokyo.lg.jp/fukushi/kodomo/teate/jidouteate.html',
      },
      '予防接種': {
        id: 'vaccine_001',
        title: '予防接種スケジュール',
        category: '健康サービス',
        score: 0.85,
        url: 'https://www.metro.tokyo.lg.jp/fukushi/hoken/yobousesshu/index.html',
      },
    },
    en: {
      'nursery': {
        id: 'childcare_001_en',
        title: 'Licensed Nursery School List',
        category: 'Childcare Services',
        score: 0.89,
        url: 'https://www.metro.tokyo.lg.jp/english/tosei/hodohappyo/press/2024/01/15/01.html',
      },
      'allowance': {
        id: 'allowance_001_en',
        title: 'Child Allowance System',
        category: 'Financial Support',
        score: 0.92,
        url: 'https://www.metro.tokyo.lg.jp/english/fukushi/kodomo/teate/jidouteate.html',
      },
      'vaccination': {
        id: 'vaccine_001_en',
        title: 'Vaccination Schedule',
        category: 'Health Services',
        score: 0.85,
        url: 'https://www.metro.tokyo.lg.jp/english/fukushi/hoken/yobousesshu/index.html',
      },
    },
  };

  const messageWords = message.toLowerCase();
  const langKeywords = keywords[language] || keywords.ja;

  for (const [keyword, source] of Object.entries(langKeywords)) {
    if (messageWords.includes(keyword.toLowerCase())) {
      mockSources.push(source);
    }
  }

  return mockSources;
}

// 音声URL生成（模擬実装）
async function generateAudioUrl(text: string, language: Language, sessionId: string): Promise<string | undefined> {
  // TODO: 実際の音声合成APIの実装
  // 現在は模擬URLを返す
  
  const timestamp = Date.now();
  return `/api/audio/temp/${sessionId}/output-${timestamp}.mp3`;
}