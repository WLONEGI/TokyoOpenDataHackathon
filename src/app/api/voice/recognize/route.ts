import { NextRequest, NextResponse } from 'next/server';
import { VoiceRequest, VoiceResponse, ApiResponse, ChatResponse, Message } from '@/types';
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

    // Check rate limit
    let rateLimitResult;
    try {
      rateLimitResult = await redisService.checkRateLimit(clientIP, 300, 50); // 5 minutes, 50 requests
    } catch (error) {
      rateLimitResult = checkRateLimit(clientIP);
    }

    if (!rateLimitResult.allowed) {
      const retryAfter = 'retryAfter' in rateLimitResult ? rateLimitResult.retryAfter : undefined;
      const error = ErrorFactory.rateLimitExceeded(retryAfter);
      const response = handleApiError(error, 'ja');
      
      const duration = timer.end();
      log.api('POST', '/api/voice/recognize', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = formData.get('sessionId') as string;
    const language = (formData.get('language') as string) || 'ja';

    // Validate inputs
    const audioValidation = validateAudioFile(audioFile);
    if (!audioValidation.isValid) {
      const error = ErrorFactory.validationFailed('Invalid audio file', audioValidation.errors);
      const response = handleApiError(error, language);
      return NextResponse.json(response, { status: error.statusCode });
    }

    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
      const error = ErrorFactory.validationFailed('Invalid session ID', sessionValidation.errors);
      const response = handleApiError(error, language);
      return NextResponse.json(response, { status: error.statusCode });
    }

    const languageValidation = validateLanguage(language);
    if (!languageValidation.isValid) {
      const error = ErrorFactory.validationFailed('Invalid language', languageValidation.errors);
      const response = handleApiError(error, language);
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Get session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      const error = ErrorFactory.sessionNotFound();
      const response = handleApiError(error, language);
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Convert audio to base64 (simplified implementation)
    const audioBytes = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioBytes).toString('base64');

    log.info('Audio file processed', {
      fileSize: audioBytes.byteLength,
      sessionId: sessionId.substring(0, 8) + '...',
      language
    }, requestId);

    // Simple transcription (Web Speech API を想定)
    let transcribedText = '';
    try {
      // 実際の実装では Web Speech API の結果をここで受け取る
      // 今回は仮の実装として、フォームデータから取得
      transcribedText = (formData.get('transcript') as string) || '';
      
      if (!transcribedText.trim()) {
        throw new Error('No transcription available');
      }
      
      log.info('Voice transcription completed', {
        transcriptionLength: transcribedText.length,
        sessionId: sessionId.substring(0, 8) + '...'
      }, requestId);
    } catch (error) {
      log.warn('Voice transcription failed', {
        error: (error as Error).message,
        sessionId: sessionId.substring(0, 8) + '...'
      }, requestId);
      
      transcribedText = '音声認識に失敗しました';
    }

    // Process through Simple RAG if transcription successful
    let ragResponse;
    let sources: any[] = [];
    
    if (transcribedText.trim().length > 0 && transcribedText !== '音声認識に失敗しました') {
      try {
        ragResponse = await simpleRAGService.processQuery(transcribedText, language as SupportedLanguage);
        
        sources = ragResponse.sources.map(source => ({
          id: source.id,
          title: source.title,
          url: source.metadata?.source || '#',
          description: source.description,
          category: source.category,
          lastUpdated: source.metadata?.lastUpdated || new Date()
        }));
        
        log.business('RAG response generated for voice input', {
          sessionId: sessionId.substring(0, 8) + '...',
          responseLength: ragResponse.content.length,
          sourceCount: sources.length,
          confidence: ragResponse.confidence,
          processingTime: ragResponse.processingTime,
        }, requestId);
      } catch (error) {
        log.error('Failed to generate RAG response for voice input', error as Error, {
          sessionId: sessionId.substring(0, 8) + '...',
        }, requestId);
        
        // Fallback to transcription only
        ragResponse = {
          content: `音声を認識しました: "${transcribedText.trim()}"`,
          confidence: 0.5,
          sources: [],
          processingTime: Date.now() - timer.start
        };
      }
    } else {
      // No valid transcription
      ragResponse = {
        content: '音声認識に失敗しました。もう一度お試しください。',
        confidence: 0.1,
        sources: [],
        processingTime: Date.now() - timer.start
      };
    }

    // Create voice response
    const voiceResponseData: VoiceResponse = {
      transcribedText,
      confidence: Math.min(0.9, ragResponse.confidence + 0.2), // 音声認識の信頼度を上乗せ
      timestamp: new Date()
    };

    // Create chat response for consistent API
    const chatResponseData: ChatResponse = {
      response: ragResponse.content,
      sources: sources.length > 0 ? sources : undefined,
      shouldPlayAudio: true, // 音声入力時は音声出力あり
      confidence: ragResponse.confidence,
      metadata: {
        processingTime: ragResponse.processingTime,
        sourceCount: ragResponse.sources.length
      }
    };

    const response: ApiResponse<{
      voice: VoiceResponse;
      chat: ChatResponse;
    }> = {
      success: true,
      data: {
        voice: voiceResponseData,
        chat: chatResponseData
      }
    };

    const duration = timer.end({
      transcriptionLength: transcribedText.length,
      responseLength: ragResponse.content.length,
      sourceCount: sources.length,
      hasChatResponse: !!ragResponse,
      audioFileSize: audioBytes.byteLength,
      confidence: ragResponse.confidence,
    });

    // Record metrics
    perfMonitor.recordCount('api.voice.recognize.success', 1);
    perfMonitor.recordTiming('api.voice.recognize.duration', duration);
    perfMonitor.recordCount('api.voice.recognize.transcriptionLength', transcribedText.length);
    perfMonitor.recordCount('api.voice.recognize.audioSize', audioBytes.byteLength);

    log.api('POST', '/api/voice/recognize', 200, duration, requestId);
    log.business('Voice recognition completed', {
      transcriptionLength: transcribedText.length,
      responseLength: ragResponse.content.length,
      sourceCount: sources.length,
      confidence: ragResponse.confidence,
      language
    }, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    perfMonitor.recordCount('api.voice.recognize.errors', 1, {
      errorCode: appError.code,
      statusCode: appError.statusCode.toString()
    });
    
    log.error('Voice Recognition API error', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('POST', '/api/voice/recognize', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}