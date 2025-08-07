// Enhanced logging system with multiple levels and structured logging

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
  requestId?: string;
  userId?: string;
  performance?: {
    duration?: number;
    memory?: NodeJS.MemoryUsage;
  };
}

class Logger {
  private minLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogHistory: number = 1000;

  constructor() {
    this.minLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    switch (level) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'FATAL': return LogLevel.FATAL;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const context = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
    const requestId = entry.requestId ? ` | RequestID: ${entry.requestId}` : '';
    const performance = entry.performance?.duration 
      ? ` | Duration: ${entry.performance.duration}ms` 
      : '';
    
    return `[${timestamp}] ${level} | ${entry.message}${context}${requestId}${performance}`;
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formattedMessage = this.formatMessage(entry);

    // Console output
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        if (entry.error) {
          console.error('Stack trace:', entry.error.stack);
        }
        break;
    }

    // Store in memory (for debugging and monitoring)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogHistory) {
      this.logs = this.logs.slice(-this.maxLogHistory);
    }
  }

  debug(message: string, context?: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date(),
      context,
      requestId,
    });
  }

  info(message: string, context?: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.INFO,
      message,
      timestamp: new Date(),
      context,
      requestId,
    });
  }

  warn(message: string, context?: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.WARN,
      message,
      timestamp: new Date(),
      context,
      requestId,
    });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.ERROR,
      message,
      timestamp: new Date(),
      error,
      context,
      requestId,
    });
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.FATAL,
      message,
      timestamp: new Date(),
      error,
      context,
      requestId,
    });
  }

  // Performance logging
  performance(message: string, duration: number, context?: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.INFO,
      message,
      timestamp: new Date(),
      context,
      requestId,
      performance: {
        duration,
        memory: process.memoryUsage(),
      },
    });
  }

  // API request logging
  apiRequest(method: string, path: string, statusCode: number, duration: number, requestId?: string): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.writeLog({
      level,
      message: `API ${method} ${path} - ${statusCode}`,
      timestamp: new Date(),
      context: {
        method,
        path,
        statusCode,
        type: 'api_request',
      },
      requestId,
      performance: {
        duration,
      },
    });
  }

  // Security logging
  security(event: string, details: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.WARN,
      message: `Security Event: ${event}`,
      timestamp: new Date(),
      context: {
        ...details,
        type: 'security_event',
      },
      requestId,
    });
  }

  // Business logic logging
  business(event: string, details: Record<string, unknown>, requestId?: string): void {
    this.writeLog({
      level: LogLevel.INFO,
      message: `Business Event: ${event}`,
      timestamp: new Date(),
      context: {
        ...details,
        type: 'business_event',
      },
      requestId,
    });
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel, count: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.level === level)
      .slice(-count);
  }

  // Get logs by time range
  getLogsByTimeRange(from: Date, to: Date): LogEntry[] {
    return this.logs.filter(log => 
      log.timestamp >= from && log.timestamp <= to
    );
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
    this.info('Log history cleared');
  }

  // Get statistics
  getStats(): {
    totalLogs: number;
    logCounts: Record<string, number>;
    oldestLog?: Date;
    newestLog?: Date;
  } {
    const logCounts: Record<string, number> = {};
    
    for (const log of this.logs) {
      const levelName = LogLevel[log.level];
      logCounts[levelName] = (logCounts[levelName] || 0) + 1;
    }

    return {
      totalLogs: this.logs.length,
      logCounts,
      oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : undefined,
      newestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : undefined,
    };
  }
}

// Create singleton logger instance
const logger = new Logger();

// Performance measurement utility
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private requestId?: string;

  constructor(name: string, requestId?: string) {
    this.name = name;
    this.requestId = requestId;
    this.startTime = Date.now();
  }

  end(context?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime;
    logger.performance(`${this.name} completed`, duration, context, this.requestId);
    return duration;
  }
}

// Request ID generator
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Export singleton logger
export { logger };

// Convenience functions
export const log = {
  debug: (message: string, context?: Record<string, unknown>, requestId?: string) => 
    logger.debug(message, context, requestId),
  
  info: (message: string, context?: Record<string, unknown>, requestId?: string) => 
    logger.info(message, context, requestId),
  
  warn: (message: string, context?: Record<string, unknown>, requestId?: string) => 
    logger.warn(message, context, requestId),
  
  error: (message: string, error?: Error, context?: Record<string, unknown>, requestId?: string) => 
    logger.error(message, error, context, requestId),
  
  fatal: (message: string, error?: Error, context?: Record<string, unknown>, requestId?: string) => 
    logger.fatal(message, error, context, requestId),
  
  performance: (name: string, requestId?: string) => 
    new PerformanceTimer(name, requestId),
  
  api: (method: string, path: string, statusCode: number, duration: number, requestId?: string) => 
    logger.apiRequest(method, path, statusCode, duration, requestId),
  
  security: (event: string, details: Record<string, unknown>, requestId?: string) => 
    logger.security(event, details, requestId),
  
  business: (event: string, details: Record<string, unknown>, requestId?: string) => 
    logger.business(event, details, requestId),
};