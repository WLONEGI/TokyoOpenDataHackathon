import { NextRequest, NextResponse } from 'next/server';
import { ChatResponse, ApiResponse, Message, SupportedLanguage } from '@/types';
import { validateChatRequest, checkRateLimit } from '@/lib/validation';
import { SessionManager } from '@/lib/services/SessionManager';
import { getRedisService } from '@/lib/services/RedisService';
import { ErrorFactory, handleApiError, AppError } from '@/lib/errors';
import { log, generateRequestId } from '@/lib/logger';
import { getPerformanceMonitor } from '@/lib/monitoring/PerformanceMonitor';
import { SimpleRAGService } from '@/lib/services/SimpleRAGService';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Chat API Request', requestId);
  const perfMonitor = getPerformanceMonitor();
  const requestStartTime = Date.now();
  
  // Record API request count
  perfMonitor.recordCount('api.chat.requests', 1, {
    method: 'POST',
    endpoint: '/api/chat'
  });
  
  try {
    const sessionManager = SessionManager.getInstance();
    const redisService = getRedisService();
    const simpleRAGService = new SimpleRAGService();

    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    log.info('Chat request received', {
      clientIP,
      userAgent: request.headers.get('user-agent'),
    }, requestId);
    
    // Check rate limit with Redis (fallback to memory)
    let rateLimitResult;
    try {
      rateLimitResult = await redisService.checkRateLimit(clientIP, 900, 100); // 15 minutes, 100 requests
    } catch (error) {
      log.warn('Redis rate limiting failed, using fallback', {
        clientIP,
        fallback: 'memory-based-rate-limiting',
        error: (error as Error).message
      });
      rateLimitResult = checkRateLimit(clientIP);
    }

    if (!rateLimitResult.allowed) {
      const retryAfter = 'retryAfter' in rateLimitResult ? rateLimitResult.retryAfter : undefined;
      const error = ErrorFactory.rateLimitExceeded(retryAfter);
      const response = handleApiError(error, 'ja');
      
      log.security('Rate limit exceeded', {
        clientIP,
        retryAfter,
      }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/chat', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { 
        status: error.statusCode,
        headers: {
          'Retry-After': retryAfter ? retryAfter.toString() : '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': ('remaining' in rateLimitResult ? rateLimitResult.remaining : 0).toString(),
          'X-RateLimit-Reset': ('resetTime' in rateLimitResult ? Math.ceil(rateLimitResult.resetTime / 1000) : Math.ceil((Date.now() + 60000) / 1000)).toString(),
        }
      });
    }

    const body = await request.json();
    
    // Validate and sanitize input
    const validation = validateChatRequest(body);
    if (!validation.isValid) {
      const error = ErrorFactory.validationFailed(
        validation.errors.join(', '),
        validation.errors
      );
      const response = handleApiError(error, body.language || 'ja');
      
      log.warn('Input validation failed', {
        errors: validation.errors,
        originalMessage: body.message?.substring(0, 100), // Truncate for logging
      }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/chat', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    const sanitizedData = validation.sanitized as any;
    const { message, sessionId, language, useVoice, inputType = 'text', location, requestedScope } = sanitizedData;

    // Validate and get session
    log.info('Attempting to get session', { sessionId: sessionId.substring(0, 8) + '...' }, requestId);
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      const error = ErrorFactory.sessionNotFound();
      const response = handleApiError(error, language);
      
      log.warn('Session not found', { sessionId: sessionId.substring(0, 8) + '...' }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/chat', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }
    log.info('Session found successfully', { 
      sessionId: sessionId.substring(0, 8) + '...',
      language: session.language,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    }, requestId);

    // Update session language if different
    if (session.language !== language) {
      await sessionManager.setSessionLanguage(sessionId, language);
      log.info('Session language updated', { 
        sessionId: sessionId.substring(0, 8) + '...', 
        from: session.language, 
        to: language 
      }, requestId);
    }

    log.business('Chat message processed', {
      messageLength: message.length,
      sessionId: sessionId.substring(0, 8) + '...', // Partial for privacy
      language,
      useVoice,
      inputType,
      sessionMessageCount: session.messageCount,
      hasLocation: !!location,
      hasRequestedScope: !!requestedScope,
    }, requestId);

    // Execute simple RAG processing
    let ragResponse;
    const ragTimer = log.performance('Simple RAG Processing', requestId);
    const perfRAGTimer = perfMonitor.startTimer('rag.processing', {
      language,
      messageLength: message.length.toString(),
      sessionId: sessionId.substring(0, 8) + '...'
    });
    
    try {
      ragResponse = await simpleRAGService.processQuery(message, language as SupportedLanguage);
      
      perfRAGTimer();
      ragTimer.end({
        confidence: ragResponse.confidence,
        sourceCount: ragResponse.sources.length,
        processingTime: ragResponse.processingTime
      });
      
      // Record RAG processing metrics
      perfMonitor.recordCount('rag.success', 1);
      perfMonitor.recordCount('rag.confidence', Math.round(ragResponse.confidence * 100));
      perfMonitor.recordCount('rag.sources', ragResponse.sources.length);
      perfMonitor.recordTiming('rag.processingTime', ragResponse.processingTime);
      
      log.info('Simple RAG processing completed', {
        confidence: ragResponse.confidence,
        sourceCount: ragResponse.sources.length,
        processingTime: ragResponse.processingTime
      }, requestId);
      
    } catch (error) {
      perfRAGTimer();
      ragTimer.end({ error: true });
      perfMonitor.recordCount('rag.errors', 1);
      
      log.error('Simple RAG processing failed', error as Error, {
        messageLength: message.length,
        sessionId: sessionId.substring(0, 8) + '...'
      }, requestId);
      
      // Fallback to basic response
      ragResponse = {
        content: `申し訳ございませんが、システム処理中にエラーが発生しました。

「${message}」について、基本的な情報をお調べします。より具体的な質問がございましたら、もう一度お聞かせください。`,
        sources: [],
        confidence: 0.2,
        processingTime: Date.now() - requestStartTime
      };
    }

    // Store user message in session with enhanced metadata
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
      metadata: {
        inputType,
        language,
        clientIP: clientIP.substring(0, 10) + '...', // Partial for privacy
        hasLocation: !!location,
        requestedScope: requestedScope ? {
          timeRange: requestedScope.timeRange,
          locationRange: requestedScope.locationRange
        } : undefined,
      },
    };

    await sessionManager.addMessage(sessionId, userMessage);

    // Handle voice synthesis (client-side)
    let audioUrl: string | undefined;
    if (useVoice) {
      log.info('Voice synthesis requested - will be handled client-side', {
        language,
        textLength: ragResponse.content.length,
        confidence: ragResponse.confidence,
      }, requestId);
      perfMonitor.recordCount('speech.clientSideRequested', 1);
    }

    // Store assistant response with simple metadata
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: ragResponse.content,
      timestamp: new Date(),
      metadata: {
        confidence: ragResponse.confidence,
        sources: ragResponse.sources.map(source => ({
          id: source.id,
          title: source.title,
          url: source.metadata?.source || '#',
          description: source.description,
          category: source.category,
          lastUpdated: source.metadata?.lastUpdated || new Date()
        })),
        processingTime: ragResponse.processingTime
      },
    };

    await sessionManager.addMessage(sessionId, assistantMessage);

    // Simple chat response with basic RAG capabilities
    const simpleChatResponse: ChatResponse & {
      confidence?: number;
      metadata?: {
        processingTime: number;
        sourceCount: number;
      };
    } = {
      response: ragResponse.content,
      audioUrl,
      sources: ragResponse.sources.length > 0 ? ragResponse.sources.map(source => ({
        id: source.id,
        title: source.title,
        url: source.metadata?.source || '#',
        description: source.description,
        category: source.category,
        lastUpdated: source.metadata?.lastUpdated || new Date()
      })) : undefined,
      shouldPlayAudio: inputType === 'voice', // 音声入力時のみ音声出力
      // Simple RAG response fields
      confidence: ragResponse.confidence,
      metadata: {
        processingTime: ragResponse.processingTime,
        sourceCount: ragResponse.sources.length
      }
    };

    const response: ApiResponse<typeof simpleChatResponse> = {
      success: true,
      data: simpleChatResponse,
    };
    
    const duration = timer.end({
      responseLength: ragResponse.content.length,
      sourceCount: ragResponse.sources.length,
      confidence: ragResponse.confidence,
      hasAudio: !!audioUrl,
      processingTime: ragResponse.processingTime,
    });
    
    // Record simple performance metrics
    perfMonitor.recordCount('api.chat.success', 1);
    perfMonitor.recordTiming('api.chat.duration', duration);
    perfMonitor.recordCount('api.chat.responseLength', ragResponse.content.length);
    perfMonitor.recordCount('api.chat.sources', ragResponse.sources.length);
    perfMonitor.recordCount('api.chat.confidence', Math.round(ragResponse.confidence * 100));
    
    log.api('POST', '/api/chat', 200, duration, requestId);
    log.business('Simple RAG chat response generated', {
      responseLength: ragResponse.content.length,
      sourceCount: ragResponse.sources.length,
      confidence: ragResponse.confidence,
      processingTime: ragResponse.processingTime,
      language
    }, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    // Record error metrics
    perfMonitor.recordCount('api.chat.errors', 1, {
      errorCode: appError.code,
      statusCode: appError.statusCode.toString()
    });
    perfMonitor.recordTiming('api.chat.errorDuration', duration);
    
    log.error('Chat API error', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('POST', '/api/chat', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}