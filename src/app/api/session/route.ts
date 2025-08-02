import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import RedisService from '@/lib/services/RedisService';
import { Session, UserPreferences, Language } from '@/types';

// セッション作成 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language = 'ja', preferences = {} }: {
      language?: Language;
      preferences?: Partial<UserPreferences>;
    } = body;

    // デフォルト設定
    const defaultPreferences: UserPreferences = {
      voiceEnabled: true,
      language: language as Language,
      responseLength: 'normal',
    };

    const finalPreferences: UserPreferences = {
      ...defaultPreferences,
      ...preferences,
    };

    // セッションデータ作成
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後

    const sessionData: Session = {
      id: sessionId,
      language: finalPreferences.language,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      preferences: finalPreferences,
    };

    // Redisに保存
    await RedisService.setSession(sessionId, sessionData, 3600); // 1時間のTTL

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        language: finalPreferences.language,
        expiresAt: expiresAt.toISOString(),
        preferences: finalPreferences,
      },
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    }, { status: 201 });

  } catch (error) {
    console.error('Session creation error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'セッションの作成に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    }, { status: 500 });
  }
}