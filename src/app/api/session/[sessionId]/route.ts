import { NextRequest, NextResponse } from 'next/server';
import { SessionData, ApiResponse } from '@/types';
import { SessionManager } from '@/lib/services/SessionManager';

const sessionManager = SessionManager.getInstance();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    if (!sessionManager.getSession(sessionId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    sessionManager.deleteSession(sessionId);

    const response: ApiResponse = {
      success: true,
      message: 'Session deleted successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error deleting session:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete session',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const body = await request.json();

    const updateResult = await sessionManager.updateSession(sessionId, body);
    if (!updateResult) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Get the updated session data
    const updatedSession = await sessionManager.getSession(sessionId);
    if (!updatedSession) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found after update',
      };
      return NextResponse.json(response, { status: 500 });
    }

    const response: ApiResponse<SessionData> = {
      success: true,
      data: updatedSession,
      message: 'Session updated successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error updating session:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update session',
    };

    return NextResponse.json(response, { status: 500 });
  }
}