import { NextRequest, NextResponse } from 'next/server';
import { VoiceRequest, VoiceResponse, ApiResponse, ChatResponse, Message } from '@/types';
import { ServiceManager } from '@/lib/services/ServiceManager';
import { SessionManager } from '@/lib/services/SessionManager';
import { getRedisService } from '@/lib/services/RedisService';
import { validateAudioFile, validateSessionId, validateLanguage, checkRateLimit } from '@/lib/validation';
import { ErrorFactory, handleApiError, AppError } from '@/lib/errors';
import { log, generateRequestId } from '@/lib/logger';
import { getPerformanceMonitor } from '@/lib/monitoring/PerformanceMonitor';
import { SimpleRAGService } from '@/lib/services/SimpleRAGService';
import { SupportedLanguage } from '@/types';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Voice Recognition API', requestId);
  const perfMonitor = getPerformanceMonitor();

  // Record API request count
  perfMonitor.recordCount('api.voice.recognize.requests', 1, {
    method: 'POST',
    endpoint: '/api/voice/recognize'
  });

  try {
    const sessionManager = SessionManager.getInstance();
    const redisService = getRedisService();
    const simpleRAGService = new SimpleRAGService();

    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    log.info('Voice recognition request received', {
      clientIP,
      userAgent: request.headers.get('user-agent'),
    }, requestId);

    // Check rate limit with Redis (fallback to memory)
    let rateLimitResult;
    try {
      rateLimitResult = await redisService.checkRateLimit(clientIP, 300, 30); // 5 minutes, 30 requests
    } catch (error) {
      log.warn('Redis rate limiting failed, using fallback', {
        clientIP,
        fallback: 'memory-based-rate-limiting',
        error: (error as Error).message
      });
      rateLimitResult = checkRateLimit(clientIP);
    }

    if (!rateLimitResult.allowed) {
      const error = ErrorFactory.rateLimitExceeded();
      const response = handleApiError(error, 'ja');
      
      const resetTime = 'resetTime' in rateLimitResult ? rateLimitResult.resetTime : Date.now() + 60000;
      log.security('Voice API rate limit exceeded', {
        clientIP,
        resetTime,
      }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { 
        status: error.statusCode,
        headers: {
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': ('remaining' in rateLimitResult ? rateLimitResult.remaining : 0).toString(),
          'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
        }
      });
    }

    const body = await request.json().catch(() => ({}));
    
    // Validate required fields
    if (!body.audioData || !body.mimeType || !body.sessionId) {
      const error = ErrorFactory.validationFailed(
        'audioData, mimeType, and sessionId are required',
        ['Missing required fields']
      );
      const response = handleApiError(error, body.language || 'ja');
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    const { audioData, mimeType, sessionId, language = 'ja', location } = body;

    // Validate session ID
    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
      const error = ErrorFactory.validationFailed(
        'Invalid session ID format',
        sessionValidation.errors
      );
      const response = handleApiError(error, language);
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Validate language
    const languageValidation = validateLanguage(language);
    if (!languageValidation.isValid) {
      const error = ErrorFactory.validationFailed(
        'Invalid language',
        languageValidation.errors
      );
      const response = handleApiError(error, language);
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Validate session exists
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      const error = ErrorFactory.sessionNotFound();
      const response = handleApiError(error, language);
      
      log.warn('Session not found for voice recognition', { 
        sessionId: sessionId.substring(0, 8) + '...' 
      }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Calculate approximate audio file size for validation
    const audioSize = Math.ceil((audioData.length * 3) / 4); // Base64 to byte approximation
    const audioFile = {
      size: audioSize,
      type: mimeType,
      data: audioData,
    };

    // Validate audio file
    const audioValidation = validateAudioFile(audioFile);
    if (!audioValidation.isValid) {
      const error = ErrorFactory.validationFailed(
        'Invalid audio file',
        audioValidation.errors
      );
      const response = handleApiError(error, language);
      
      log.warn('Invalid audio file provided', {
        mimeType,
        size: audioSize,
        errors: audioValidation.errors,
      }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    log.business('Voice recognition processing started', {
      sessionId: sessionId.substring(0, 8) + '...',
      language,
      mimeType,
      audioSize,
    }, requestId);

    // Process audio with Gemini
    let transcribedText: string;
    const geminiTimer = log.performance('Gemini Audio Processing', requestId);
    const perfGeminiTimer = perfMonitor.startTimer('gemini.audioProcessing', {
      language,
      mimeType,
      audioSize: audioSize.toString()
    });

    try {
      const audioResult = await geminiService.processAudio(audioData, mimeType);
      transcribedText = audioResult.text;
      perfGeminiTimer();
      geminiTimer.end({ 
        success: true,
        textLength: transcribedText?.length || 0 
      });

      perfMonitor.recordCount('gemini.audioProcessing.success', 1);
      perfMonitor.recordCount('gemini.audioProcessing.textLength', transcribedText?.length || 0);
    } catch (error) {
      perfGeminiTimer();
      geminiTimer.end({ error: true });
      perfMonitor.recordCount('gemini.audioProcessing.errors', 1);

      const audioError = ErrorFactory.audioProcessingFailed(error);
      const response = handleApiError(audioError, language);
      
      log.error('Gemini audio processing failed', error as Error, {
        sessionId: sessionId.substring(0, 8) + '...',
        mimeType,
        audioSize,
      }, requestId);
      
      const duration = timer.end({ error: true });
      log.api('POST', '/api/voice/recognize', audioError.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: audioError.statusCode });
    }

    if (!transcribedText || transcribedText.trim().length === 0) {
      const error = ErrorFactory.audioProcessingFailed('No text detected in audio');
      const response = handleApiError(error, language);
      
      log.warn('No text detected in audio', {
        sessionId: sessionId.substring(0, 8) + '...',
        mimeType,
        audioSize,
      }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // 音声入力の場合はAIオーケストレーターを使用してチャットレスポンスも生成
    let aiResponse;
    let sources: any[] = [];
    
    if (transcribedText.trim().length > 0) {
      try {
        // Execute simple RAG processing
        const ragResponse = await simpleRAGService.processQuery(transcribedText, language as SupportedLanguage);
        
        sources = aiResponse.sources.map(source => ({
          id: source.title.toLowerCase().replace(/\s+/g, '-'),
          title: source.title,
          url: source.type === 'opendata' ? '#' : undefined,
          description: `${source.type} source with ${source.reliability} reliability`,
          category: source.type,
          lastUpdated: new Date()
        }));
        
        log.business('AI response generated for voice input', {
          sessionId: sessionId.substring(0, 8) + '...',
          responseLength: aiResponse.content.length,
          sourceCount: sources.length,
          confidence: aiResponse.confidence,
          hasLocation: !!location,
        }, requestId);
      } catch (error) {
        log.error('Failed to generate AI response for voice input', error as Error, {
          sessionId: sessionId.substring(0, 8) + '...',
        }, requestId);
        
        // Fallback to basic response
        aiResponse = {
          content: transcribedText.trim(),
          confidence: 0.5,
          reasoning: { approach: 'fallback', keyInsights: [], thoughtProcess: [], evidenceSummary: '' },
          sources: [],
          recommendations: [],
          metadata: { processingTime: 0, toolsUsed: [], dataSourcesAccessed: [], qualityScore: 0.5 }
        };
      }
    }

    const voiceResponse: VoiceResponse = {
      text: transcribedText.trim(),
    };

    // 音声入力の場合はChatResponse形式で返す
    const chatResponseData: ChatResponse = {
      response: aiResponse?.content || transcribedText.trim(),
      sources: sources.length > 0 ? sources : undefined,
      shouldPlayAudio: true, // 音声入力時は音声出力あり
      confidence: aiResponse?.confidence,
      reasoning: aiResponse?.reasoning,
      recommendations: aiResponse?.recommendations,
      metadata: aiResponse?.metadata
    };

    const response: ApiResponse<ChatResponse> = {
      success: true,
      data: chatResponseData,
    };

    const duration = timer.end({
      textLength: transcribedText.length,
      language,
    });

    // Record success metrics
    perfMonitor.recordCount('api.voice.recognize.success', 1);
    perfMonitor.recordTiming('api.voice.recognize.duration', duration);
    perfMonitor.recordCount('api.voice.recognize.textLength', transcribedText.length);

    log.business('Voice recognition completed successfully', {
      sessionId: sessionId.substring(0, 8) + '...',
      textLength: transcribedText.length,
      language,
      hasChatResponse: !!aiResponse,
      sourceCount: sources.length,
      hasLocation: !!location,
      confidence: aiResponse?.confidence,
    }, requestId);

    log.api('POST', '/api/voice/recognize', 200, duration, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    // Record error metrics
    perfMonitor.recordCount('api.voice.recognize.errors', 1, {
      errorCode: appError.code,
      statusCode: appError.statusCode.toString()
    });
    perfMonitor.recordTiming('api.voice.recognize.errorDuration', duration);
    
    log.error('Voice recognition API error', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('POST', '/api/voice/recognize', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}