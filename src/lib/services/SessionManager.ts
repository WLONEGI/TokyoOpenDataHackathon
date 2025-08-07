import { v4 as uuidv4 } from 'uuid';
import { SessionData, Message, SupportedLanguage } from '@/types';
import { getRedisService } from './RedisService';
import { log } from '@/lib/logger';
import { config } from '@/lib/config';

// Global storage that persists across hot reloads in development
const globalForSessions = globalThis as unknown as {
  memorySessions: Map<string, SessionData>;
  memoryMessages: Map<string, Message[]>;
  cleanupInterval: NodeJS.Timeout | null;
};

export class SessionManager {
  private static instance: SessionManager;
  private redisService = getRedisService();
  private memorySessions: Map<string, SessionData>;
  private memoryMessages: Map<string, Message[]>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private gcInterval: NodeJS.Timeout | null = null;
  private readonly MAX_MEMORY_SESSIONS = 10000; // メモリ内セッション数の上限
  private readonly MAX_MESSAGES_PER_SESSION = 100; // セッションごとのメッセージ数上限

  private constructor() {
    // Use global storage in development to persist across hot reloads
    if (process.env.NODE_ENV === 'development') {
      if (!globalForSessions.memorySessions) {
        globalForSessions.memorySessions = new Map();
        globalForSessions.memoryMessages = new Map();
        log.info('Initialized global session storage for development');
      }
      this.memorySessions = globalForSessions.memorySessions;
      this.memoryMessages = globalForSessions.memoryMessages;
      
      // Only start cleanup if not already started
      if (!globalForSessions.cleanupInterval) {
        this.startCleanupProcess();
      }
    } else {
      this.memorySessions = new Map();
      this.memoryMessages = new Map();
      this.startCleanupProcess();
    }
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private startCleanupProcess(): void {
    // Clean up expired sessions more frequently (every 10 minutes)
    const interval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 10 * 60 * 1000);
    
    // Store interval reference globally in development
    if (process.env.NODE_ENV === 'development') {
      globalForSessions.cleanupInterval = interval;
    } else {
      // Store reference for production cleanup
      this.cleanupInterval = interval;
    }
    
    // Force garbage collection periodically in production
    if (process.env.NODE_ENV === 'production' && global.gc) {
      setInterval(() => {
        try {
          global.gc();
          log.debug('Manual garbage collection triggered');
        } catch (error) {
          // Ignore GC errors
        }
      }, 30 * 60 * 1000); // Every 30 minutes
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];
    const oldSessions: Array<{ sessionId: string; lastActivity: number }> = [];

    // Check memory sessions
    for (const [sessionId, session] of this.memorySessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceActivity > config.maxSessionDuration) {
        expiredSessions.push(sessionId);
      } else {
        oldSessions.push({ sessionId, lastActivity: timeSinceActivity });
      }
    }

    // Memory pressure management: remove oldest sessions if over limit
    if (this.memorySessions.size > this.MAX_MEMORY_SESSIONS) {
      oldSessions.sort((a, b) => b.lastActivity - a.lastActivity);
      const sessionsToRemove = oldSessions.slice(this.MAX_MEMORY_SESSIONS - expiredSessions.length);
      for (const { sessionId } of sessionsToRemove) {
        expiredSessions.push(sessionId);
        log.warn(`Removing session due to memory pressure: ${sessionId.substring(0, 8)}...`);
      }
    }

    // Clean up expired sessions in batches to avoid blocking
    const batchSize = 50;
    for (let i = 0; i < expiredSessions.length; i += batchSize) {
      const batch = expiredSessions.slice(i, i + batchSize);
      await Promise.all(batch.map(sessionId => this.deleteSession(sessionId)));
      
      // Allow event loop to process other tasks
      if (i + batchSize < expiredSessions.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    // Clean up orphaned messages (messages without corresponding sessions)
    const orphanedMessageSessions: string[] = [];
    for (const sessionId of this.memoryMessages.keys()) {
      if (!this.memorySessions.has(sessionId)) {
        orphanedMessageSessions.push(sessionId);
      }
    }
    
    for (const sessionId of orphanedMessageSessions) {
      this.memoryMessages.delete(sessionId);
    }

    if (expiredSessions.length > 0 || orphanedMessageSessions.length > 0) {
      log.info(`Cleaned up ${expiredSessions.length} expired sessions and ${orphanedMessageSessions.length} orphaned message sets. Memory usage: ${this.memorySessions.size} sessions, ${this.memoryMessages.size} message sets`);
    }
  }

  async createSession(language: SupportedLanguage = 'ja', metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  }): Promise<string> {
    const sessionId = uuidv4();
    const now = new Date();

    const sessionData: SessionData = {
      id: sessionId,
      language,
      createdAt: now,
      lastActivity: now,
      messageCount: 0,
      isActive: true,
      metadata: metadata || {},
    };

    try {
      // Try to store in Redis first
      const redisStored = await this.redisService.setSession(
        sessionId, 
        sessionData, 
        Math.floor(config.maxSessionDuration / 1000)
      );

      if (!redisStored) {
        // Fallback to memory storage
        this.memorySessions.set(sessionId, sessionData);
        this.memoryMessages.set(sessionId, []);
        log.warn('Session stored in memory (Redis unavailable)', { sessionId });
        
        // Verify storage
        const stored = this.memorySessions.get(sessionId);
        log.info('Session memory storage verified', {
          sessionId: sessionId.substring(0, 8) + '...',
          stored: !!stored,
          totalSessions: this.memorySessions.size,
          isDevelopment: process.env.NODE_ENV === 'development',
          usingGlobalStorage: process.env.NODE_ENV === 'development' && this.memorySessions === globalForSessions.memorySessions
        });
      }

      log.info('Session created', { 
        sessionId: sessionId.substring(0, 8) + '...',
        language,
        storage: redisStored ? 'redis' : 'memory'
      });

      return sessionId;
    } catch (error) {
      log.error('Failed to create session', error as Error, { sessionId });
      throw new Error('Failed to create session');
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) {
      return null;
    }

    try {
      // Try Redis first
      let sessionData = await this.redisService.getSession(sessionId);
      
      if (!sessionData) {
        // Fallback to memory storage
        sessionData = this.memorySessions.get(sessionId) || null;
        if (sessionData) {
          // Update last activity
          sessionData.lastActivity = new Date();
          this.memorySessions.set(sessionId, sessionData);
        } else {
          log.warn('Session not found in memory storage', { 
            sessionId: sessionId.substring(0, 8) + '...',
            totalSessionsInMemory: this.memorySessions.size,
            availableSessionIds: Array.from(this.memorySessions.keys()).map(id => id.substring(0, 8) + '...'),
            isDevelopment: process.env.NODE_ENV === 'development',
            usingGlobalStorage: process.env.NODE_ENV === 'development' && this.memorySessions === globalForSessions.memorySessions,
            globalSessionCount: process.env.NODE_ENV === 'development' ? globalForSessions.memorySessions?.size : 'N/A'
          });
        }
      }

      if (!sessionData) {
        return null;
      }

      // Check if session is expired
      const now = new Date();
      const lastActivity = new Date(sessionData.lastActivity);
      const timeSinceActivity = now.getTime() - lastActivity.getTime();
      
      if (timeSinceActivity > config.maxSessionDuration) {
        log.warn('Session expired', { 
          sessionId: sessionId.substring(0, 8) + '...',
          timeSinceActivity,
          maxDuration: config.maxSessionDuration
        });
        await this.deleteSession(sessionId);
        return null;
      }

      return sessionData;
    } catch (error) {
      log.error('Failed to retrieve session', error as Error, { sessionId });
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
    try {
      const existingSession = await this.getSession(sessionId);
      if (!existingSession) {
        return false;
      }

      const updatedSession: SessionData = {
        ...existingSession,
        ...updates,
        lastActivity: new Date(),
      };

      // Try Redis first
      const redisUpdated = await this.redisService.setSession(
        sessionId,
        updatedSession,
        Math.floor(config.maxSessionDuration / 1000)
      );

      if (!redisUpdated) {
        // Fallback to memory storage
        this.memorySessions.set(sessionId, updatedSession);
      }

      return true;
    } catch (error) {
      log.error('Failed to update session', error as Error, { sessionId });
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Delete from Redis
      const redisDeleted = await this.redisService.deleteSession(sessionId);
      
      // Delete from memory
      const memoryDeleted = this.memorySessions.delete(sessionId);
      this.memoryMessages.delete(sessionId);

      if (redisDeleted || memoryDeleted) {
        log.info('Session deleted', { sessionId: sessionId.substring(0, 8) + '...' });
        return true;
      }

      return false;
    } catch (error) {
      log.error('Failed to delete session', error as Error, { sessionId });
      return false;
    }
  }

  async addMessage(sessionId: string, message: Message): Promise<boolean> {
    try {
      // Try Redis first
      const redisAdded = await this.redisService.addMessage(sessionId, message);
      
      if (!redisAdded) {
        // Fallback to memory storage
        if (!this.memoryMessages.has(sessionId)) {
          this.memoryMessages.set(sessionId, []);
        }
        const messages = this.memoryMessages.get(sessionId)!;
        messages.push(message);
        
        // Keep only last MAX_MESSAGES_PER_SESSION messages
        if (messages.length > this.MAX_MESSAGES_PER_SESSION) {
          messages.splice(0, messages.length - this.MAX_MESSAGES_PER_SESSION);
        }
      }

      // Update session message count and last activity
      await this.updateSession(sessionId, {
        messageCount: (await this.getMessages(sessionId)).length,
      });

      return true;
    } catch (error) {
      log.error('Failed to add message to session', error as Error, { sessionId });
      return false;
    }
  }

  async getMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    try {
      // Try Redis first
      let messages = await this.redisService.getMessages(sessionId, limit);
      
      if (messages.length === 0) {
        // Fallback to memory storage
        const memoryMessages = this.memoryMessages.get(sessionId) || [];
        messages = memoryMessages.slice(-limit);
      }

      // Convert timestamp strings back to Date objects if needed
      return messages.map(message => ({
        ...message,
        timestamp: new Date(message.timestamp),
      }));
    } catch (error) {
      log.error('Failed to retrieve messages', error as Error, { sessionId });
      return [];
    }
  }

  async clearMessages(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      // Clear from Redis
      await this.redisService.deleteCache(`messages:${sessionId}`);
      
      // Clear from memory
      this.memoryMessages.set(sessionId, []);

      // Update session
      await this.updateSession(sessionId, { messageCount: 0 });

      return true;
    } catch (error) {
      log.error('Failed to clear messages', error as Error, { sessionId });
      return false;
    }
  }

  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    memorySessionCount: number;
    redisSessionCount: number;
    averageMessagesPerSession: number;
    languageDistribution: Record<SupportedLanguage, number>;
  }> {
    try {
      const memorySessionCount = this.memorySessions.size;
      const redisStats = await this.redisService.getStats();
      const redisSessionCount = redisStats.totalKeys ? 
        Math.floor(redisStats.totalKeys / 2) : 0;
      
      // Language distribution from memory sessions
      const languageDistribution: Record<SupportedLanguage, number> = {
        ja: 0,
        en: 0,
        zh: 0,
        ko: 0,
      };

      let totalMessages = 0;
      for (const [sessionId, session] of this.memorySessions.entries()) {
        languageDistribution[session.language]++;
        totalMessages += this.memoryMessages.get(sessionId)?.length || 0;
      }

      const totalSessions = memorySessionCount + redisSessionCount;
      const averageMessagesPerSession = totalSessions > 0 ? 
        totalMessages / totalSessions : 0;

      return {
        totalActiveSessions: totalSessions,
        memorySessionCount,
        redisSessionCount,
        averageMessagesPerSession: Number(averageMessagesPerSession.toFixed(2)),
        languageDistribution,
      };
    } catch (error) {
      log.error('Failed to get session stats', error as Error);
      return {
        totalActiveSessions: 0,
        memorySessionCount: 0,
        redisSessionCount: 0,
        averageMessagesPerSession: 0,
        languageDistribution: { ja: 0, en: 0, zh: 0, ko: 0 },
      };
    }
  }

  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null && session.isActive;
  }

  async setSessionLanguage(sessionId: string, language: SupportedLanguage): Promise<boolean> {
    return this.updateSession(sessionId, { language });
  }

  // Legacy methods for backwards compatibility
  getSessionCount(): number {
    return this.memorySessions.size;
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.memorySessions.values());
  }

  async cleanup(): Promise<void> {
    // Clear cleanup intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
    
    // Clear global cleanup interval in development
    if (process.env.NODE_ENV === 'development' && globalForSessions.cleanupInterval) {
      clearInterval(globalForSessions.cleanupInterval);
      globalForSessions.cleanupInterval = null;
    }
    
    // Clear memory storage
    this.memorySessions.clear();
    this.memoryMessages.clear();
    
    // Clear global storage in development
    if (process.env.NODE_ENV === 'development') {
      globalForSessions.memorySessions?.clear();
      globalForSessions.memoryMessages?.clear();
    }
    
    // Cleanup Redis service
    await this.redisService.cleanup();
    
    log.info('SessionManager cleanup completed');
  }

  // Memory usage monitoring
  getMemoryUsage(): {
    sessionCount: number;
    messageSetCount: number;
    estimatedMemoryMB: number;
    isNearLimit: boolean;
  } {
    const sessionCount = this.memorySessions.size;
    const messageSetCount = this.memoryMessages.size;
    
    // Rough estimation: each session ~1KB, each message ~0.5KB
    let totalMessages = 0;
    for (const messages of this.memoryMessages.values()) {
      totalMessages += messages.length;
    }
    
    const estimatedMemoryMB = Math.round(
      (sessionCount * 1 + totalMessages * 0.5) / 1024
    );
    
    const isNearLimit = sessionCount > this.MAX_MEMORY_SESSIONS * 0.8;
    
    return {
      sessionCount,
      messageSetCount,
      estimatedMemoryMB,
      isNearLimit,
    };
  }
}