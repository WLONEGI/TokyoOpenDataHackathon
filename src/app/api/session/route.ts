import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/services/SessionManager';
import { validateLanguage } from '@/lib/validation';
import { ErrorFactory, handleApiError, AppError } from '@/lib/errors';
import { log, generateRequestId } from '@/lib/logger';
import { ApiResponse, SupportedLanguage } from '@/types';

// Create new session
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Create Session API', requestId);

  try {
    const sessionManager = SessionManager.getInstance();
    const body = await request.json().catch(() => ({}));

    // Get client metadata
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Determine device type from user agent
    const deviceType = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) 
      ? 'mobile' as const 
      : /Tablet|iPad/i.test(userAgent) 
        ? 'tablet' as const 
        : 'desktop' as const;

    // Validate language
    let language: SupportedLanguage = 'ja';
    if (body.language) {
      const langValidation = validateLanguage(body.language);
      if (langValidation.isValid) {
        language = langValidation.sanitized as SupportedLanguage;
      } else {
        log.warn('Invalid language provided, using default', {
          providedLanguage: body.language,
          errors: langValidation.errors,
        }, requestId);
      }
    }

    const sessionId = await sessionManager.createSession(language, {
      userAgent,
      ipAddress: clientIP,
      deviceType,
    });

    log.business('Session created', {
      sessionId: sessionId.substring(0, 8) + '...',
      language,
      deviceType,
      clientIP,
    }, requestId);

    const response: ApiResponse<{ sessionId: string; language: SupportedLanguage }> = {
      success: true,
      data: {
        sessionId,
        language,
      },
    };

    const duration = timer.end();
    log.api('POST', '/api/session', 201, duration, requestId);

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    log.error('Session creation failed', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('POST', '/api/session', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}

// Get session information
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Get Session API', requestId);

  try {
    const sessionManager = SessionManager.getInstance();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      const error = ErrorFactory.validationFailed('Session ID is required');
      const response = handleApiError(error, 'ja');
      
      const duration = timer.end();
      log.api('GET', '/api/session', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      const error = ErrorFactory.sessionNotFound();
      const response = handleApiError(error, 'ja');
      
      log.warn('Session not found in GET request', { 
        sessionId: sessionId.substring(0, 8) + '...' 
      }, requestId);
      
      const duration = timer.end();
      log.api('GET', '/api/session', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    const response: ApiResponse<typeof session> = {
      success: true,
      data: session,
    };

    const duration = timer.end();
    log.api('GET', '/api/session', 200, duration, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    log.error('Session retrieval failed', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('GET', '/api/session', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}

// Delete session
export async function DELETE(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Delete Session API', requestId);

  try {
    const sessionManager = SessionManager.getInstance();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      const error = ErrorFactory.validationFailed('Session ID is required');
      const response = handleApiError(error, 'ja');
      
      const duration = timer.end();
      log.api('DELETE', '/api/session', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    const deleted = await sessionManager.deleteSession(sessionId);
    if (!deleted) {
      const error = ErrorFactory.sessionNotFound();
      const response = handleApiError(error, 'ja');
      
      log.warn('Session not found for deletion', { 
        sessionId: sessionId.substring(0, 8) + '...' 
      }, requestId);
      
      const duration = timer.end();
      log.api('DELETE', '/api/session', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    log.business('Session deleted', {
      sessionId: sessionId.substring(0, 8) + '...',
    }, requestId);

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
    };

    const duration = timer.end();
    log.api('DELETE', '/api/session', 200, duration, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    log.error('Session deletion failed', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('DELETE', '/api/session', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}