import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import RedisService from '@/lib/services/RedisService';
import { Session, UserPreferences } from '@/types';

// セッション取得 API
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'セッションIDが必要です',
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      }, { status: 400 });
    }

    // セッションデータ取得
    const sessionData = await RedisService.getSession(sessionId);
    
    if (!sessionData) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '指定されたセッションが見つかりません',
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      }, { status: 404 });
    }

    // セッション有効期限チェック
    const now = new Date();
    const expiresAt = new Date(sessionData.expiresAt);
    
    if (now >= expiresAt) {
      await RedisService.deleteSession(sessionId);
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'セッションの有効期限が切れています',
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      }, { status: 410 });
    }

    // 最終アクセス時刻更新
    await RedisService.updateSessionAccess(sessionId);

    return NextResponse.json({
      success: true,
      data: sessionData,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });

  } catch (error) {
    console.error('Session get error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'セッションの取得に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    }, { status: 500 });
  }
}

// セッション更新 API
export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const body = await request.json();
    const { preferences }: { preferences: Partial<UserPreferences> } = body;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'セッションIDが必要です',
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      }, { status: 400 });
    }

    // 既存セッション取得
    const sessionData = await RedisService.getSession(sessionId);
    
    if (!sessionData) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '指定されたセッションが見つかりません',
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      }, { status: 404 });
    }

    // 設定更新
    const updatedPreferences: UserPreferences = {
      ...sessionData.preferences,
      ...preferences,
    };

    const updatedSession: Session = {
      ...sessionData,
      preferences: updatedPreferences,
      lastAccessedAt: new Date().toISOString(),
    };

    // Redisに保存
    await RedisService.setSession(sessionId, updatedSession, 3600);

    return NextResponse.json({
      success: true,
      data: updatedSession,
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });

  } catch (error) {
    console.error('Session update error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'セッションの更新に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    }, { status: 500 });
  }
}

// セッション削除 API
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'セッションIDが必要です',
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      }, { status: 400 });
    }

    // セッション削除
    await RedisService.deleteSession(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        deletedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    });

  } catch (error) {
    console.error('Session delete error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'セッションの削除に失敗しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    }, { status: 500 });
  }
}