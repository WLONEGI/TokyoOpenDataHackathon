import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/services/SessionManager';
import { validateSessionId } from '@/lib/validation';
import { ErrorFactory, handleApiError, AppError } from '@/lib/errors';
import { log, generateRequestId } from '@/lib/logger';
import { ApiResponse, Message } from '@/types';

// Get session message history
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Get Session History API', requestId);

  try {
    const sessionManager = SessionManager.getInstance();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const limitStr = url.searchParams.get('limit');
    const offsetStr = url.searchParams.get('offset');

    // Validate session ID
    if (!sessionId) {
      const error = ErrorFactory.validationFailed('Session ID is required');
      const response = handleApiError(error, 'ja');
      
      const duration = timer.end();
      log.api('GET', '/api/session/history', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
      const error = ErrorFactory.validationFailed(
        'Invalid session ID format',
        sessionValidation.errors
      );
      const response = handleApiError(error, 'ja');
      
      const duration = timer.end();
      log.api('GET', '/api/session/history', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Validate limit parameter
    let limit = 50; // default
    if (limitStr) {
      const parsedLimit = parseInt(limitStr, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        const error = ErrorFactory.validationFailed('Limit must be between 1 and 100');
        const response = handleApiError(error, 'ja');
        
        const duration = timer.end();
        log.api('GET', '/api/session/history', error.statusCode, duration, requestId);
        
        return NextResponse.json(response, { status: error.statusCode });
      }
      limit = parsedLimit;
    }

    // Check if session exists
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      const error = ErrorFactory.sessionNotFound();
      const response = handleApiError(error, 'ja');
      
      log.warn('Session not found for history request', { 
        sessionId: sessionId.substring(0, 8) + '...' 
      }, requestId);
      
      const duration = timer.end();
      log.api('GET', '/api/session/history', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Get messages
    const messages = await sessionManager.getMessages(sessionId, limit);

    log.business('Session history retrieved', {
      sessionId: sessionId.substring(0, 8) + '...',
      messageCount: messages.length,
      limit,
      language: session.language,
    }, requestId);

    const response: ApiResponse<{
      messages: Message[];
      sessionInfo: {
        id: string;
        language: string;
        messageCount: number;
        createdAt: Date;
        lastActivity: Date;
      };
    }> = {
      success: true,
      data: {
        messages,
        sessionInfo: {
          id: session.id,
          language: session.language,
          messageCount: session.messageCount,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
        },
      },
    };

    const duration = timer.end();
    log.api('GET', '/api/session/history', 200, duration, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    log.error('Session history retrieval failed', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('GET', '/api/session/history', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}

// Clear session message history
export async function DELETE(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Clear Session History API', requestId);

  try {
    const sessionManager = SessionManager.getInstance();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    // Validate session ID
    if (!sessionId) {
      const error = ErrorFactory.validationFailed('Session ID is required');
      const response = handleApiError(error, 'ja');
      
      const duration = timer.end();
      log.api('DELETE', '/api/session/history', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
      const error = ErrorFactory.validationFailed(
        'Invalid session ID format',
        sessionValidation.errors
      );
      const response = handleApiError(error, 'ja');
      
      const duration = timer.end();
      log.api('DELETE', '/api/session/history', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Check if session exists
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      const error = ErrorFactory.sessionNotFound();
      const response = handleApiError(error, 'ja');
      
      log.warn('Session not found for history clear', { 
        sessionId: sessionId.substring(0, 8) + '...' 
      }, requestId);
      
      const duration = timer.end();
      log.api('DELETE', '/api/session/history', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Clear messages
    const cleared = await sessionManager.clearMessages(sessionId);
    if (!cleared) {
      const error = ErrorFactory.internalError('Failed to clear session history');
      const response = handleApiError(error, session.language);
      
      const duration = timer.end();
      log.api('DELETE', '/api/session/history', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    log.business('Session history cleared', {
      sessionId: sessionId.substring(0, 8) + '...',
      language: session.language,
    }, requestId);

    const response: ApiResponse<{ cleared: boolean }> = {
      success: true,
      data: { cleared: true },
    };

    const duration = timer.end();
    log.api('DELETE', '/api/session/history', 200, duration, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    log.error('Session history clear failed', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('DELETE', '/api/session/history', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}