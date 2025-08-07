import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, SupportedLanguage } from '@/types';
import { SessionManager } from '@/lib/services/SessionManager';
import { SimpleRAGService } from '@/lib/services/SimpleRAGService';
import { validateChatRequest } from '@/lib/validation';
import { ErrorFactory, handleApiError, AppError } from '@/lib/errors';
import { log, generateRequestId } from '@/lib/logger';
import { getPerformanceMonitor } from '@/lib/monitoring/PerformanceMonitor';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Chat Streaming API', requestId);
  const perfMonitor = getPerformanceMonitor();

  // Record API request count
  perfMonitor.recordCount('api.chat.stream.requests', 1, {
    method: 'POST',
    endpoint: '/api/chat/stream'
  });

  try {
    const sessionManager = SessionManager.getInstance();
    const simpleRAGService = new SimpleRAGService();

    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    log.info('Chat streaming request received', {
      clientIP,
      userAgent: request.headers.get('user-agent'),
    }, requestId);

    // Parse request body
    const body: ChatRequest = await request.json();

    // Validate request
    const validation = validateChatRequest(body);
    if (!validation.isValid) {
      const error = ErrorFactory.validationFailed('Invalid chat request', validation.errors);
      const response = handleApiError(error, body.language);
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Get or create session
    const session = await sessionManager.getOrCreateSession(
      body.sessionId, 
      body.language as SupportedLanguage
    );

    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // SSE helper function
        const sendSSE = (data: any, event?: string) => {
          const message = event ? `event: ${event}\n` : '';
          const dataStr = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message + dataStr));
        };

        // Start streaming processing
        simpleRAGService.processQueryStreaming(
          body.message,
          body.language as SupportedLanguage,
          (step) => {
            // Send each step as SSE
            sendSSE({
              type: 'step',
              step: step.step,
              status: step.status,
              message: step.message,
              timestamp: step.timestamp,
              data: step.data
            }, 'step');
          }
        ).then((result) => {
          // Send final result
          sendSSE({
            type: 'result',
            content: result.content,
            sources: result.sources,
            confidence: result.confidence,
            processingTime: result.processingTime
          }, 'result');

          // Close stream
          sendSSE({ type: 'done' }, 'done');
          controller.close();

          // Log completion
          const duration = timer.end({
            messageLength: body.message.length,
            responseLength: result.content.length,
            sourceCount: result.sources.length,
            confidence: result.confidence,
            language: body.language
          });

          perfMonitor.recordCount('api.chat.stream.success', 1);
          perfMonitor.recordTiming('api.chat.stream.duration', duration);

          log.api('POST', '/api/chat/stream', 200, duration, requestId);
          log.business('Chat streaming completed', {
            messageLength: body.message.length,
            responseLength: result.content.length,
            sourceCount: result.sources.length,
            confidence: result.confidence,
            language: body.language
          }, requestId);

        }).catch((error) => {
          // Send error
          sendSSE({
            type: 'error',
            message: 'エラーが発生しました',
            error: error.message
          }, 'error');

          controller.close();

          log.error('Chat streaming processing failed', error as Error, {
            message: body.message.substring(0, 50),
            language: body.language
          }, requestId);
        });
      }
    });

    // Return SSE response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    perfMonitor.recordCount('api.chat.stream.errors', 1, {
      errorCode: appError.code,
      statusCode: appError.statusCode.toString()
    });
    
    log.error('Chat Streaming API error', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('POST', '/api/chat/stream', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}