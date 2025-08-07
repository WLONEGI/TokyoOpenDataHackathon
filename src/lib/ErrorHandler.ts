// Centralized error handling system
import { AppError, ErrorCode, ErrorFactory, extractErrorInfo } from './errors';
import { log } from './logger';

export interface ErrorContext {
  service: string;
  operation: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorHandlingResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    userMessage: string;
    isRetryable: boolean;
  };
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Wraps a service operation with standardized error handling
   */
  async handleServiceOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    language: string = 'ja'
  ): Promise<ErrorHandlingResult<T>> {
    const { service, operation: operationName, requestId, sessionId } = context;
    
    try {
      const result = await operation();
      
      log.debug(`${service}.${operationName} completed successfully`, {
        requestId,
        sessionId: sessionId?.substring(0, 8) + '...',
        service,
        operation: operationName,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return this.handleError(error, context, language);
    }
  }

  /**
   * Handles errors with consistent logging and response formatting
   */
  handleError(
    error: unknown,
    context: ErrorContext,
    language: string = 'ja'
  ): ErrorHandlingResult {
    const { service, operation, requestId, sessionId } = context;
    
    let appError: AppError;
    
    // Convert to AppError if not already
    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      // Map common error types to AppError
      appError = this.mapErrorToAppError(error, context);
    } else {
      appError = ErrorFactory.internalError(error);
    }

    // Log error with context
    log.error(`${service}.${operation} failed`, error as Error, {
      requestId,
      sessionId: sessionId?.substring(0, 8) + '...',
      service,
      operation,
      errorCode: appError.code,
      isRetryable: appError.isRetryable,
      metadata: context.metadata,
    });

    return {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        userMessage: appError.getUserMessage(language),
        isRetryable: appError.isRetryable,
      },
    };
  }

  /**
   * Maps common error types to appropriate AppError instances
   */
  private mapErrorToAppError(error: Error, context: ErrorContext): AppError {
    const errorMessage = error.message.toLowerCase();
    
    // Network/API errors
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      return new AppError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: `External service unavailable: ${error.message}`,
        statusCode: 503,
        isRetryable: true,
        userMessage: {
          ja: '外部サービスが一時的に利用できません。しばらく後にお試しください。',
          en: 'External service is temporarily unavailable. Please try again later.',
          zh: '外部服务暂时不可用。请稍后再试。',
          ko: '외부 서비스가 일시적으로 사용할 수 없습니다. 나중에 다시 시도해주세요.',
        },
      });
    }

    // Timeout errors
    if (errorMessage.includes('timeout')) {
      return new AppError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: `Operation timeout: ${error.message}`,
        statusCode: 504,
        isRetryable: true,
        userMessage: {
          ja: 'リクエストがタイムアウトしました。しばらく後にお試しください。',
          en: 'Request timed out. Please try again later.',
          zh: '请求超时。请稍后再试。',
          ko: '요청이 시간 초과되었습니다. 나중에 다시 시도해주세요.',
        },
      });
    }

    // Redis/Storage errors
    if (errorMessage.includes('redis') || errorMessage.includes('storage')) {
      return new AppError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: `Storage service error: ${error.message}`,
        statusCode: 503,
        isRetryable: true,
        userMessage: {
          ja: 'ストレージサービスでエラーが発生しました。',
          en: 'Storage service error occurred.',
          zh: '存储服务发生错误。',
          ko: '스토리지 서비스에서 오류가 발생했습니다.',
        },
      });
    }

    // Configuration errors
    if (errorMessage.includes('config') || errorMessage.includes('environment')) {
      return new AppError({
        code: ErrorCode.CONFIGURATION_ERROR,
        message: `Configuration error: ${error.message}`,
        statusCode: 500,
        isRetryable: false,
        userMessage: {
          ja: 'システム設定エラーが発生しました。',
          en: 'System configuration error occurred.',
          zh: '系统配置错误。',
          ko: '시스템 구성 오류가 발생했습니다.',
        },
      });
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return ErrorFactory.validationFailed(error.message);
    }

    // Default to internal error
    return ErrorFactory.internalError(error);
  }

  /**
   * Handles async operations with retry logic
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      retryMultiplier?: number;
      language?: string;
    } = {}
  ): Promise<ErrorHandlingResult<T>> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      retryMultiplier = 2,
      language = 'ja',
    } = options;

    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          log.info(`${context.service}.${context.operation} succeeded after ${attempt} attempts`, {
            requestId: context.requestId,
            sessionId: context.sessionId?.substring(0, 8) + '...',
            service: context.service,
            operation: context.operation,
          });
        }
        
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        lastError = error;
        
        // Don't retry on non-retryable errors
        if (error instanceof AppError && !error.isRetryable) {
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(retryMultiplier, attempt - 1);
          
          log.warn(`${context.service}.${context.operation} failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
            requestId: context.requestId,
            sessionId: context.sessionId?.substring(0, 8) + '...',
            service: context.service,
            operation: context.operation,
            error: extractErrorInfo(error),
            attempt,
            delay,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    return this.handleError(lastError, {
      ...context,
      metadata: {
        ...context.metadata,
        maxRetries,
        finalAttempt: true,
      },
    }, language);
  }

  /**
   * Wraps multiple parallel operations with error handling
   */
  async handleParallelOperations<T>(
    operations: Array<() => Promise<T>>,
    context: ErrorContext,
    options: {
      failFast?: boolean;
      language?: string;
    } = {}
  ): Promise<ErrorHandlingResult<T[]>> {
    const { failFast = false, language = 'ja' } = options;

    try {
      let results: T[];
      
      if (failFast) {
        // Fail fast: if any operation fails, the whole operation fails
        results = await Promise.all(operations.map(op => op()));
      } else {
        // Collect all results, including errors
        const settled = await Promise.allSettled(operations.map(op => op()));
        results = [];
        
        const errors: Error[] = [];
        
        for (const result of settled) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            errors.push(result.reason);
          }
        }
        
        // If there were errors but some operations succeeded, log warnings
        if (errors.length > 0) {
          log.warn(`${context.service}.${context.operation} had partial failures`, {
            requestId: context.requestId,
            sessionId: context.sessionId?.substring(0, 8) + '...',
            service: context.service,
            operation: context.operation,
            successCount: results.length,
            errorCount: errors.length,
            totalOperations: operations.length,
          });
          
          // If all operations failed, return error
          if (results.length === 0) {
            return this.handleError(errors[0], context, language);
          }
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      return this.handleError(error, context, language);
    }
  }

  /**
   * Handles circuit breaker pattern for external services
   */
  private circuitBreakers = new Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
  }>();

  async handleWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options: {
      serviceName: string;
      failureThreshold?: number;
      recoveryTimeout?: number;
      language?: string;
    }
  ): Promise<ErrorHandlingResult<T>> {
    const {
      serviceName,
      failureThreshold = 5,
      recoveryTimeout = 60000, // 1 minute
      language = 'ja',
    } = options;

    const circuitBreaker = this.circuitBreakers.get(serviceName) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed' as const,
    };

    const now = Date.now();

    // Check circuit breaker state
    if (circuitBreaker.state === 'open') {
      if (now - circuitBreaker.lastFailure < recoveryTimeout) {
        // Circuit is still open
        return this.handleError(
          new AppError({
            code: ErrorCode.SERVICE_UNAVAILABLE,
            message: `Service ${serviceName} is temporarily unavailable (circuit breaker open)`,
            statusCode: 503,
            isRetryable: true,
            userMessage: {
              ja: 'サービスが一時的に利用できません。しばらく後にお試しください。',
              en: 'Service is temporarily unavailable. Please try again later.',
              zh: '服务暂时不可用。请稍后再试。',
              ko: '서비스가 일시적으로 사용할 수 없습니다. 나중에 다시 시도해주세요.',
            },
          }),
          context,
          language
        );
      } else {
        // Try to recover - set to half-open
        circuitBreaker.state = 'half-open';
      }
    }

    try {
      const result = await operation();
      
      // Operation succeeded - reset circuit breaker
      if (circuitBreaker.failures > 0) {
        circuitBreaker.failures = 0;
        circuitBreaker.state = 'closed';
        this.circuitBreakers.set(serviceName, circuitBreaker);
        
        log.info(`Circuit breaker for ${serviceName} reset to closed state`, {
          requestId: context.requestId,
          service: context.service,
          operation: context.operation,
        });
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Operation failed - update circuit breaker
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = now;

      if (circuitBreaker.failures >= failureThreshold) {
        circuitBreaker.state = 'open';
        log.warn(`Circuit breaker for ${serviceName} opened due to ${circuitBreaker.failures} failures`, {
          requestId: context.requestId,
          service: context.service,
          operation: context.operation,
          failureThreshold,
        });
      } else if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'open';
      }

      this.circuitBreakers.set(serviceName, circuitBreaker);
      
      return this.handleError(error, context, language);
    }
  }
}

// Convenience functions
export const errorHandler = ErrorHandler.getInstance();

export const handleServiceOperation = <T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  language?: string
) => errorHandler.handleServiceOperation(operation, context, language);

export const handleWithRetry = <T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options?: Parameters<typeof errorHandler.handleWithRetry>[2]
) => errorHandler.handleWithRetry(operation, context, options);

export const handleParallelOperations = <T>(
  operations: Array<() => Promise<T>>,
  context: ErrorContext,
  options?: Parameters<typeof errorHandler.handleParallelOperations>[2]
) => errorHandler.handleParallelOperations(operations, context, options);

export const handleWithCircuitBreaker = <T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: Parameters<typeof errorHandler.handleWithCircuitBreaker>[2]
) => errorHandler.handleWithCircuitBreaker(operation, context, options);