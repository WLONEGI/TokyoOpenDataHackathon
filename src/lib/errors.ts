// Standardized error handling system

export enum ErrorCode {
  // Authentication & Authorization
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Validation
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_SESSION = 'INVALID_SESSION',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  
  // External Services
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  GEMINI_QUOTA_EXCEEDED = 'GEMINI_QUOTA_EXCEEDED',
  GEMINI_UNAVAILABLE = 'GEMINI_UNAVAILABLE',
  
  // Data & Search
  SEARCH_FAILED = 'SEARCH_FAILED',
  DATA_FETCH_FAILED = 'DATA_FETCH_FAILED',
  INDEX_INITIALIZATION_FAILED = 'INDEX_INITIALIZATION_FAILED',
  
  // Audio Processing
  AUDIO_PROCESSING_FAILED = 'AUDIO_PROCESSING_FAILED',
  UNSUPPORTED_AUDIO_FORMAT = 'UNSUPPORTED_AUDIO_FORMAT',
  AUDIO_TOO_LARGE = 'AUDIO_TOO_LARGE',
  
  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: any;
  statusCode: number;
  isRetryable: boolean;
  userMessage: Record<string, string>; // Multi-language user messages
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;
  public readonly details?: any;
  public readonly userMessage: Record<string, string>;

  constructor(errorDetails: ErrorDetails) {
    super(errorDetails.message);
    this.name = 'AppError';
    this.code = errorDetails.code;
    this.statusCode = errorDetails.statusCode;
    this.isRetryable = errorDetails.isRetryable;
    this.details = errorDetails.details;
    this.userMessage = errorDetails.userMessage;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AppError);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      details: this.details,
      stack: this.stack,
    };
  }

  getUserMessage(language: string = 'ja'): string {
    return this.userMessage[language] || this.userMessage.ja || this.message;
  }
}

// Predefined error factories
export const ErrorFactory = {
  validationFailed: (details: string, validationErrors?: string[]): AppError => {
    return new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: `Validation failed: ${details}`,
      details: validationErrors,
      statusCode: 400,
      isRetryable: false,
      userMessage: {
        ja: '入力内容に問題があります。正しい形式で入力してください。',
        en: 'There is an issue with your input. Please enter in the correct format.',
        zh: '输入内容有问题。请以正确格式输入。',
        ko: '입력 내용에 문제가 있습니다. 올바른 형식으로 입력해주세요.',
      },
    });
  },

  rateLimitExceeded: (retryAfter: number = 60): AppError => {
    return new AppError({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      details: { retryAfter },
      statusCode: 429,
      isRetryable: true,
      userMessage: {
        ja: 'リクエストが多すぎます。しばらくお待ちください。',
        en: 'Too many requests. Please wait a moment.',
        zh: '请求过多。请稍等。',
        ko: '요청이 너무 많습니다. 잠시 기다려 주세요.',
      },
    });
  },

  sessionNotFound: (): AppError => {
    return new AppError({
      code: ErrorCode.SESSION_NOT_FOUND,
      message: 'Session not found or expired',
      statusCode: 404,
      isRetryable: false,
      userMessage: {
        ja: 'セッションが見つからないか期限切れです。新しいセッションを作成してください。',
        en: 'Session not found or expired. Please create a new session.',
        zh: '会话未找到或已过期。请创建新会话。',
        ko: '세션을 찾을 수 없거나 만료되었습니다. 새 세션을 만들어주세요.',
      },
    });
  },

  geminiApiError: (originalError: any): AppError => {
    const isQuotaError = originalError?.message?.toLowerCase().includes('quota');
    const isUnavailable = originalError?.message?.toLowerCase().includes('unavailable');
    
    if (isQuotaError) {
      return new AppError({
        code: ErrorCode.GEMINI_QUOTA_EXCEEDED,
        message: 'Gemini API quota exceeded',
        details: originalError,
        statusCode: 503,
        isRetryable: true,
        userMessage: {
          ja: 'AIサービスの利用制限に達しました。しばらく後にお試しください。',
          en: 'AI service usage limit reached. Please try again later.',
          zh: 'AI服务使用限制已达到。请稍后再试。',
          ko: 'AI 서비스 사용 한도에 도달했습니다. 나중에 다시 시도해주세요.',
        },
      });
    }
    
    if (isUnavailable) {
      return new AppError({
        code: ErrorCode.GEMINI_UNAVAILABLE,
        message: 'Gemini API temporarily unavailable',
        details: originalError,
        statusCode: 503,
        isRetryable: true,
        userMessage: {
          ja: 'AIサービスが一時的に利用できません。しばらく後にお試しください。',
          en: 'AI service is temporarily unavailable. Please try again later.',
          zh: 'AI服务暂时不可用。请稍后再试。',
          ko: 'AI 서비스가 일시적으로 사용할 수 없습니다. 나중에 다시 시도해주세요.',
        },
      });
    }
    
    return new AppError({
      code: ErrorCode.GEMINI_API_ERROR,
      message: 'Gemini API error',
      details: originalError,
      statusCode: 500,
      isRetryable: false,
      userMessage: {
        ja: 'AIサービスでエラーが発生しました。',
        en: 'An error occurred with the AI service.',
        zh: 'AI服务发生错误。',
        ko: 'AI 서비스에서 오류가 발생했습니다.',
      },
    });
  },

  searchFailed: (originalError: any): AppError => {
    return new AppError({
      code: ErrorCode.SEARCH_FAILED,
      message: 'Search operation failed',
      details: originalError,
      statusCode: 500,
      isRetryable: true,
      userMessage: {
        ja: '検索処理でエラーが発生しました。',
        en: 'An error occurred during search.',
        zh: '搜索处理中发生错误。',
        ko: '검색 처리 중 오류가 발생했습니다.',
      },
    });
  },

  audioProcessingFailed: (originalError: any): AppError => {
    return new AppError({
      code: ErrorCode.AUDIO_PROCESSING_FAILED,
      message: 'Audio processing failed',
      details: originalError,
      statusCode: 500,
      isRetryable: true,
      userMessage: {
        ja: '音声処理でエラーが発生しました。',
        en: 'An error occurred during audio processing.',
        zh: '音频处理中发生错误。',
        ko: '음성 처리 중 오류가 발생했습니다.',
      },
    });
  },

  internalError: (originalError: any): AppError => {
    return new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? originalError : undefined,
      statusCode: 500,
      isRetryable: false,
      userMessage: {
        ja: 'システムエラーが発生しました。しばらく後にお試しください。',
        en: 'A system error occurred. Please try again later.',
        zh: '系统错误。请稍后再试。',
        ko: '시스템 오류가 발생했습니다. 나중에 다시 시도해주세요.',
      },
    });
  },
};

// Error handler for API responses
export const handleApiError = (error: any, language: string = 'ja') => {
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.getUserMessage(language),
      code: error.code,
      retryable: error.isRetryable,
    };
  }
  
  // Handle unknown errors
  const internalError = ErrorFactory.internalError(error);
  return {
    success: false,
    error: internalError.getUserMessage(language),
    code: internalError.code,
    retryable: internalError.isRetryable,
  };
};

// Utility to safely extract error information
export const extractErrorInfo = (error: any): { message: string; stack?: string; details?: any } => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      details: error instanceof AppError ? error.details : undefined,
    };
  }
  
  if (typeof error === 'string') {
    return { message: error };
  }
  
  if (typeof error === 'object' && error !== null) {
    return {
      message: error.message || 'Unknown error',
      details: error,
    };
  }
  
  return { message: 'Unknown error occurred' };
};