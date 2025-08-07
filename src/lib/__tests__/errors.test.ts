import { 
  AppError, 
  ErrorCode, 
  ErrorFactory, 
  handleApiError, 
  extractErrorInfo 
} from '../errors';

describe('AppError', () => {
  test('should create instance with required properties', () => {
    const error = new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Test error',
      statusCode: 400,
      isRetryable: false,
      details: ['detail1', 'detail2'],
      userMessage: {
        ja: 'テストエラー',
        en: 'Test error'
      }
    });

    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.isRetryable).toBe(false);
    expect(error.details).toEqual(['detail1', 'detail2']);
  });

  test('should return correct user message for different languages', () => {
    const error = new AppError({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      statusCode: 429,
      isRetryable: true,
      userMessage: {
        ja: 'リクエスト回数が上限を超えました。しばらくお待ちください。',
        en: 'Too many requests. Please wait a moment.',
        zh: '请求次数超过限制。请稍后再试。',
        ko: '요청 횟수가 한도를 초과했습니다. 잠시 기다려 주세요.'
      }
    });

    expect(error.getUserMessage('ja')).toContain('リクエスト');
    expect(error.getUserMessage('en')).toContain('Too many');
    expect(error.getUserMessage('zh')).toContain('请求');
    expect(error.getUserMessage('ko')).toContain('요청');
  });

  test('should fallback to English for unknown language', () => {
    const error = new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal error',
      statusCode: 500,
      isRetryable: false,
      userMessage: {
        ja: '内部エラーが発生しました。',
        en: 'Internal error occurred.'
      }
    });

    const message = error.getUserMessage('unknown' as any);
    expect(message).toBe(error.getUserMessage('ja'));
  });
});

describe('ErrorFactory', () => {
  test('should create validation error', () => {
    const error = ErrorFactory.validationFailed('Invalid input', ['field1']);
    
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.statusCode).toBe(400);
    expect(error.isRetryable).toBe(false);
    expect(error.details).toEqual(['field1']);
  });

  test('should create session not found error', () => {
    const error = ErrorFactory.sessionNotFound();
    
    expect(error.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.isRetryable).toBe(false);
  });

  test('should create rate limit error', () => {
    const error = ErrorFactory.rateLimitExceeded();
    
    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.statusCode).toBe(429);
    expect(error.isRetryable).toBe(true);
    expect(error.details.retryAfter).toBe(60);
    expect(error.getUserMessage('en')).toContain('Too many requests');
  });

  test('should create Gemini quota error', () => {
    const originalError = new Error('quota exceeded');
    const error = ErrorFactory.geminiApiError(originalError);
    
    expect(error.code).toBe(ErrorCode.GEMINI_QUOTA_EXCEEDED);
    expect(error.statusCode).toBe(503);
    expect(error.isRetryable).toBe(true);
    expect(error.getUserMessage('ja')).toContain('利用制限');
  });

  test('should create Gemini unavailable error', () => {
    const originalError = new Error('service unavailable');
    const error = ErrorFactory.geminiApiError(originalError);
    
    expect(error.code).toBe(ErrorCode.GEMINI_UNAVAILABLE);
    expect(error.statusCode).toBe(503);
    expect(error.isRetryable).toBe(true);
  });

  test('should create generic Gemini error', () => {
    const originalError = new Error('Unknown API error');
    const error = ErrorFactory.geminiApiError(originalError);
    
    expect(error.code).toBe(ErrorCode.GEMINI_API_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.isRetryable).toBe(false);
  });

  test('should create search failed error', () => {
    const originalError = new Error('Database connection failed');
    const error = ErrorFactory.searchFailed(originalError);
    
    expect(error.code).toBe(ErrorCode.SEARCH_FAILED);
    expect(error.statusCode).toBe(500);
    expect(error.isRetryable).toBe(true);
  });

  test('should create internal error', () => {
    const originalError = new Error('Unexpected error');
    const error = ErrorFactory.internalError(originalError);
    
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.isRetryable).toBe(false);
  });
});

describe('handleApiError', () => {
  test('should handle AppError properly', () => {
    const appError = ErrorFactory.validationFailed('Test error');
    const result = handleApiError(appError, 'en');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(appError.getUserMessage('en'));
    expect(result.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(result.retryable).toBe(false);
  });

  test('should handle unknown error', () => {
    const unknownError = new Error('Random error');
    const result = handleApiError(unknownError, 'ja');
    
    expect(result.success).toBe(false);
    expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('システムエラー');
  });

  test('should use correct language', () => {
    const error = ErrorFactory.rateLimitExceeded();
    const resultJa = handleApiError(error, 'ja');
    const resultEn = handleApiError(error, 'en');
    
    expect(resultJa.error).toContain('リクエストが多すぎます');
    expect(resultEn.error).toContain('Too many requests');
  });
});

describe('extractErrorInfo', () => {
  test('should extract info from Error object', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test';
    
    const info = extractErrorInfo(error);
    
    expect(info.message).toBe('Test error');
    expect(info.stack).toBe('Error: Test error\n    at test');
  });

  test('should extract info from AppError', () => {
    const appError = ErrorFactory.validationFailed('Validation failed', ['field1']);
    const info = extractErrorInfo(appError);
    
    expect(info.message).toBe(appError.message);
    expect(info.details).toEqual(['field1']);
  });

  test('should handle string error', () => {
    const info = extractErrorInfo('String error message');
    
    expect(info.message).toBe('String error message');
    expect(info.stack).toBeUndefined();
  });

  test('should handle object error', () => {
    const errorObject = { message: 'Object error', code: 500 };
    const info = extractErrorInfo(errorObject);
    
    expect(info.message).toBe('Object error');
    expect(info.details).toEqual(errorObject);
  });

  test('should handle null/undefined', () => {
    const infoNull = extractErrorInfo(null);
    const infoUndefined = extractErrorInfo(undefined);
    
    expect(infoNull.message).toBe('Unknown error occurred');
    expect(infoUndefined.message).toBe('Unknown error occurred');
  });
});