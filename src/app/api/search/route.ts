import { NextRequest, NextResponse } from 'next/server';
import { SearchQuery, ApiResponse, OpenDataItem, SupportedLanguage } from '@/types';
import { ServiceManager } from '@/lib/services/ServiceManager';
import { SessionManager } from '@/lib/services/SessionManager';
import { getRedisService } from '@/lib/services/RedisService';
import { OpenDataService } from '@/lib/services/OpenDataService';
import { validateAndSanitizeText, validateSessionId, validateLanguage, checkRateLimit } from '@/lib/validation';
import { ErrorFactory, handleApiError, AppError } from '@/lib/errors';
import { log, generateRequestId } from '@/lib/logger';
import { getPerformanceMonitor } from '@/lib/monitoring/PerformanceMonitor';

interface SearchResponse {
  items: OpenDataItem[];
  totalCount: number;
  query: string;
  processingTime: number;
  usedCache: boolean;
  suggestions?: string[];
  facets?: {
    categories: Record<string, number>;
    sources: Record<string, number>;
    tags: Record<string, number>;
  };
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Search API POST', requestId);
  const perfMonitor = getPerformanceMonitor();
  const requestStartTime = Date.now();

  perfMonitor.recordCount('api.search.post.requests', 1, {
    method: 'POST',
    endpoint: '/api/search'
  });

  try {
    const serviceManager = ServiceManager.getInstance();
    const sessionManager = SessionManager.getInstance();
    const redisService = getRedisService();
    const vectorSearchService = await serviceManager.getVectorSearchService();
    const openDataService = new OpenDataService();

    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    log.info('Search POST request received', {
      clientIP,
      userAgent: request.headers.get('user-agent'),
    }, requestId);

    // Check rate limit
    let rateLimitResult;
    try {
      rateLimitResult = await redisService.checkRateLimit(clientIP, 300, 60); // 5 minutes, 60 requests
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
      log.security('Search POST API rate limit exceeded', {
        clientIP,
        resetTime,
      }, requestId);
      
      const duration = timer.end();
      log.api('POST', '/api/search', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { 
        status: error.statusCode,
        headers: {
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': ('remaining' in rateLimitResult ? rateLimitResult.remaining : 0).toString(),
          'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
        }
      });
    }

    const body = await request.json().catch(() => ({}));
    const { text, category, language = 'ja', limit = 10, sessionId } = body;

    // Validate required text parameter
    if (!text) {
      const error = ErrorFactory.validationFailed('Search text is required');
      const response = handleApiError(error, language);
      
      const duration = timer.end();
      log.api('POST', '/api/search', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Validate and sanitize text
    const textValidation = validateAndSanitizeText(text, 'search text');
    if (!textValidation.isValid) {
      const error = ErrorFactory.validationFailed(
        'Invalid search text',
        textValidation.errors
      );
      const response = handleApiError(error, language);
      
      const duration = timer.end();
      log.api('POST', '/api/search', error.statusCode, duration, requestId);
      
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
      log.api('POST', '/api/search', error.statusCode, duration, requestId);
      
      return NextResponse.json(response, { status: error.statusCode });
    }

    // Validate session if provided
    if (sessionId) {
      const sessionValidation = validateSessionId(sessionId);
      if (!sessionValidation.isValid) {
        const error = ErrorFactory.validationFailed(
          'Invalid session ID format',
          sessionValidation.errors
        );
        const response = handleApiError(error, language);
        
        const duration = timer.end();
        log.api('POST', '/api/search', error.statusCode, duration, requestId);
        
        return NextResponse.json(response, { status: error.statusCode });
      }

      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        log.warn('Session not found for search POST', { 
          sessionId: sessionId.substring(0, 8) + '...' 
        }, requestId);
      }
    }

    const sanitizedText = textValidation.sanitized!;
    const validatedLanguage = languageValidation.sanitized as SupportedLanguage;
    const validatedLimit = Math.min(Math.max(limit, 1), 50); // Between 1 and 50

    log.business('Search POST processing started', {
      query: sanitizedText.substring(0, 100),
      sessionId: sessionId?.substring(0, 8) + '...',
      language: validatedLanguage,
      category,
      limit: validatedLimit,
    }, requestId);

    // Perform searches in parallel
    const searchPromises = [
      vectorSearchService.search({
        text: sanitizedText,
        category,
        language: validatedLanguage,
        limit: Math.ceil(validatedLimit * 0.7)
      }),
      openDataService.searchChildcareInfo(sanitizedText)
    ];

    const [vectorResults, openDataResults] = await Promise.allSettled(searchPromises);

    let combinedItems: OpenDataItem[] = [];
    let usedCache = false;

    // Process vector search results
    if (vectorResults.status === 'fulfilled') {
      const vectorResult = vectorResults.value;
      if (Array.isArray(vectorResult)) {
        // If it's an array of OpenDataItem
        combinedItems.push(...vectorResult);
      } else {
        // If it's a SearchResult object
        combinedItems.push(...vectorResult.items);
        usedCache = vectorResult.usedCache || false;
      }
      
      const resultCount = Array.isArray(vectorResult) ? vectorResult.length : vectorResult.items.length;
      perfMonitor.recordCount('search.vectorSearch.results', resultCount);
    } else {
      log.warn('Vector search failed', { error: vectorResults.reason }, requestId);
      perfMonitor.recordCount('search.vectorSearch.errors', 1);
    }

    // Process open data search results
    if (openDataResults.status === 'fulfilled') {
      const existingIds = new Set(combinedItems.map(item => item.id));
      const openDataResult = openDataResults.value;
      const openDataItems = Array.isArray(openDataResult) ? openDataResult : openDataResult.items || [];
      const newItems = openDataItems.filter(item => !existingIds.has(item.id));
      combinedItems.push(...newItems.slice(0, Math.ceil(validatedLimit * 0.3)));
      
      perfMonitor.recordCount('search.openData.results', openDataItems.length);
    } else {
      log.warn('Open data search failed', { error: openDataResults.reason }, requestId);
      perfMonitor.recordCount('search.openData.errors', 1);
    }

    // Apply category filter if specified
    if (category) {
      combinedItems = combinedItems.filter(item => 
        item.category === category || item.tags.includes(category)
      );
    }

    // Limit results
    const limitedItems = combinedItems.slice(0, validatedLimit);

    const searchResponse: SearchResponse = {
      items: limitedItems,
      totalCount: combinedItems.length,
      query: sanitizedText,
      processingTime: Date.now() - requestStartTime,
      usedCache,
    };

    const response: ApiResponse<SearchResponse> = {
      success: true,
      data: searchResponse,
    };

    const duration = timer.end({
      query: sanitizedText.substring(0, 50),
      totalResults: combinedItems.length,
      returnedResults: limitedItems.length,
      language: validatedLanguage,
    });

    perfMonitor.recordCount('api.search.post.success', 1);
    perfMonitor.recordTiming('api.search.post.duration', duration);

    log.business('Search POST completed successfully', {
      query: sanitizedText.substring(0, 50),
      totalResults: combinedItems.length,
      returnedResults: limitedItems.length,
      language: validatedLanguage,
    }, requestId);

    log.api('POST', '/api/search', 200, duration, requestId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    perfMonitor.recordCount('api.search.post.errors', 1, {
      errorCode: appError.code,
      statusCode: appError.statusCode.toString()
    });
    
    log.error('Search POST API error', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
    }, requestId);
    
    log.api('POST', '/api/search', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Search API GET', requestId);
  const perfMonitor = getPerformanceMonitor();

  perfMonitor.recordCount('api.search.get.requests', 1, {
    method: 'GET',
    endpoint: '/api/search'
  });

  try {
    const serviceManager = ServiceManager.getInstance();
    const vectorSearchService = await serviceManager.getVectorSearchService();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    log.info('Search GET request received', {
      action,
      query: searchParams.get('query')?.substring(0, 50),
    }, requestId);

    if (action === 'stats') {
      const stats = vectorSearchService.getStats();
      
      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      const duration = timer.end({ action: 'stats' });
      log.api('GET', '/api/search?action=stats', 200, duration, requestId);

      return NextResponse.json(response, { status: 200 });

    } else if (action === 'recommendations') {
      const query = searchParams.get('query') || '';
      const limit = Math.min(parseInt(searchParams.get('limit') || '3'), 10); // Max 10 recommendations
      
      // Validate query if provided
      if (query) {
        const queryValidation = validateAndSanitizeText(query, 'query');
        if (!queryValidation.isValid) {
          const error = ErrorFactory.validationFailed(
            'Invalid query for recommendations',
            queryValidation.errors
          );
          const response = handleApiError(error, 'ja');
          
          const duration = timer.end();
          log.api('GET', '/api/search?action=recommendations', error.statusCode, duration, requestId);
          
          return NextResponse.json(response, { status: error.statusCode });
        }
      }

      const recommendations = await vectorSearchService.getRecommendations(query, limit);
      
      const response: ApiResponse = {
        success: true,
        data: {
          items: recommendations,
          total: recommendations.length,
          query: query || null,
        },
      };

      const duration = timer.end({ 
        action: 'recommendations', 
        query: query.substring(0, 30),
        count: recommendations.length 
      });
      
      log.business('Search recommendations generated', {
        query: query.substring(0, 50),
        count: recommendations.length,
        limit,
      }, requestId);

      log.api('GET', '/api/search?action=recommendations', 200, duration, requestId);

      return NextResponse.json(response, { status: 200 });

    } else {
      const error = ErrorFactory.validationFailed('Invalid or missing action parameter');
      const response = handleApiError(error, 'ja');

      const duration = timer.end();
      log.api('GET', '/api/search', error.statusCode, duration, requestId);

      return NextResponse.json(response, { status: error.statusCode });
    }

  } catch (error) {
    const appError = error instanceof AppError ? error : ErrorFactory.internalError(error);
    const response = handleApiError(appError, 'ja');
    
    const duration = timer.end({ error: true });
    
    perfMonitor.recordCount('api.search.get.errors', 1, {
      errorCode: appError.code,
      statusCode: appError.statusCode.toString()
    });
    
    log.error('Search GET API error', error as Error, {
      code: appError.code,
      statusCode: appError.statusCode,
      action: new URL(request.url).searchParams.get('action'),
    }, requestId);
    
    log.api('GET', '/api/search', appError.statusCode, duration, requestId);

    return NextResponse.json(response, { status: appError.statusCode });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}