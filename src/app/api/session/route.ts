import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { SessionData, ApiResponse } from '@/types';
import { SessionManager } from '@/lib/services/SessionManager';

const sessionManager = SessionManager.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language = 'ja' } = body;

    const sessionId = uuidv4();
    const sessionData = sessionManager.createSession(
      sessionId,
      language as 'ja' | 'en' | 'zh' | 'ko'
    );

    const response: ApiResponse<{ sessionId: string }> = {
      success: true,
      data: { sessionId },
      message: 'Session created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create session',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'Session ID is required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const sessionData = sessionManager.getSession(sessionId);
    if (!sessionData) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<SessionData> = {
      success: true,
      data: sessionData,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error retrieving session:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve session',
    };

    return NextResponse.json(response, { status: 500 });
  }
}