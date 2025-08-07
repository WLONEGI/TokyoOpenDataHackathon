import { createClient, RedisClientType } from 'redis';
import { config, isDevelopment } from '@/lib/config';
import { log } from '@/lib/logger';
import { SessionData, Message } from '@/types';

export class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    // Check if Redis is explicitly disabled
    if (process.env.DISABLE_REDIS === 'true') {
      log.info('Redis explicitly disabled via DISABLE_REDIS environment variable');
      return;
    }

    // Only initialize Redis if configured or in production
    if (config.redisUrl || !isDevelopment()) {
      this.initializeClient();
    } else {
      log.info('Redis URL not configured in development, using memory storage only');
    }
  }

  private async initializeClient(): Promise<void> {
    try {
      // Skip initialization if in development and no Redis URL provided
      if (!config.redisUrl && isDevelopment()) {
        log.info('Development mode: Redis URL not configured, skipping Redis initialization');
        return;
      }

      if (!config.redisUrl && !isDevelopment()) {
        log.warn('Production mode: Redis URL not configured, falling back to memory storage');
        return;
      }

      // Redis client configuration
      const clientOptions = config.redisUrl ? {
        url: config.redisUrl,
        socket: {
          connectTimeout: 10000,
          lazyConnect: true,
          reconnectStrategy: (retries: number) => {
            if (retries >= this.maxReconnectAttempts) {
              log.error('Redis max reconnection attempts reached');
              return false;
            }
            const delay = Math.min(retries * 50, 500);
            log.warn(`Redis reconnecting in ${delay}ms (attempt ${retries + 1})`);
            return delay;
          },
        },
      } : {
        // Local development fallback
        socket: {
          host: 'localhost',
          port: 6379,
          connectTimeout: 5000,
          lazyConnect: true,
        },
      };

      this.client = createClient(clientOptions);

      // Error handling
      this.client.on('error', (err) => {
        log.error('Redis client error', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        log.info('Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('disconnect', () => {
        log.warn('Redis client disconnected');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        log.info(`Redis client reconnecting (attempt ${this.reconnectAttempts})`);
      });

      // Connect to Redis
      await this.client.connect();
      
    } catch (error) {
      log.error('Failed to initialize Redis client', error as Error);
      this.client = null;
      this.isConnected = false;
    }
  }

  private getKey(prefix: string, id: string): string {
    return `tokyo-ai:${prefix}:${id}`;
  }

  async isReady(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Session Management
  async setSession(sessionId: string, sessionData: SessionData, ttl: number = 3600): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      log.warn('Redis not available for session storage');
      return false;
    }

    try {
      const key = this.getKey('session', sessionId);
      const data = JSON.stringify({
        ...sessionData,
        updatedAt: new Date().toISOString(),
      });
      
      await this.client.setEx(key, ttl, data);
      
      log.debug('Session stored in Redis', { sessionId, ttl });
      return true;
    } catch (error) {
      log.error('Failed to store session in Redis', error as Error, { sessionId });
      return false;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const key = this.getKey('session', sessionId);
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      const sessionData = JSON.parse(data) as SessionData;
      
      // Update last activity
      sessionData.lastActivity = new Date();
      await this.setSession(sessionId, sessionData);
      
      log.debug('Session retrieved from Redis', { sessionId });
      return sessionData;
    } catch (error) {
      log.error('Failed to retrieve session from Redis', error as Error, { sessionId });
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const sessionKey = this.getKey('session', sessionId);
      const messagesKey = this.getKey('messages', sessionId);
      
      await Promise.all([
        this.client.del(sessionKey),
        this.client.del(messagesKey),
      ]);
      
      log.debug('Session deleted from Redis', { sessionId });
      return true;
    } catch (error) {
      log.error('Failed to delete session from Redis', error as Error, { sessionId });
      return false;
    }
  }

  // Message Storage
  async addMessage(sessionId: string, message: Message): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const key = this.getKey('messages', sessionId);
      const messageData = JSON.stringify(message);
      
      // Add to list and set expiration
      await this.client.rPush(key, messageData);
      await this.client.expire(key, 86400); // 24 hours
      
      // Keep only last 100 messages
      await this.client.lTrim(key, -100, -1);
      
      log.debug('Message added to Redis', { sessionId, messageId: message.id });
      return true;
    } catch (error) {
      log.error('Failed to add message to Redis', error as Error, { sessionId });
      return false;
    }
  }

  async getMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      const key = this.getKey('messages', sessionId);
      const messages = await this.client.lRange(key, -limit, -1);
      
      return messages.map(data => JSON.parse(data) as Message);
    } catch (error) {
      log.error('Failed to retrieve messages from Redis', error as Error, { sessionId });
      return [];
    }
  }

  // Cache Management
  async setCache(key: string, value: any, ttl: number = 300): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.getKey('cache', key);
      const data = JSON.stringify({
        value,
        timestamp: new Date().toISOString(),
      });
      
      await this.client.setEx(cacheKey, ttl, data);
      return true;
    } catch (error) {
      log.error('Failed to set cache in Redis', error as Error, { key });
      return false;
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.getKey('cache', key);
      const data = await this.client.get(cacheKey);
      
      if (!data) {
        return null;
      }

      const cached = JSON.parse(data);
      return cached.value as T;
    } catch (error) {
      log.error('Failed to get cache from Redis', error as Error, { key });
      return null;
    }
  }

  async deleteCache(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.getKey('cache', key);
      await this.client.del(cacheKey);
      return true;
    } catch (error) {
      log.error('Failed to delete cache from Redis', error as Error, { key });
      return false;
    }
  }

  // Rate Limiting
  async checkRateLimit(identifier: string, windowSeconds: number, maxRequests: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    if (!this.client || !this.isConnected) {
      // Fallback to allowing request if Redis is not available
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    }

    try {
      const key = this.getKey('ratelimit', identifier);
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;

      // Remove old entries and count current requests
      await this.client.zRemRangeByScore(key, 0, windowStart);
      const currentCount = await this.client.zCard(key);

      if (currentCount >= maxRequests) {
        const oldestEntry = await this.client.zRangeWithScores(key, 0, 0);
        const resetTime = oldestEntry.length > 0 ? 
          Number(oldestEntry[0].score) + windowSeconds * 1000 : 
          now + windowSeconds * 1000;

        return {
          allowed: false,
          remaining: 0,
          resetTime,
        };
      }

      // Add current request
      await this.client.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await this.client.expire(key, windowSeconds);

      return {
        allowed: true,
        remaining: maxRequests - currentCount - 1,
        resetTime: now + windowSeconds * 1000,
      };
    } catch (error) {
      log.error('Rate limit check failed in Redis', error as Error, { identifier });
      // Fallback to allowing request
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    }
  }

  // Statistics
  async getStats(): Promise<{
    connected: boolean;
    memoryUsage?: string;
    connectedClients?: number;
    totalKeys?: number;
  }> {
    if (!this.client || !this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.client.info();
      const keyCount = await this.client.dbSize();
      
      // Parse info for relevant stats
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const clientsMatch = info.match(/connected_clients:(\d+)/);
      
      return {
        connected: true,
        memoryUsage: memoryMatch ? memoryMatch[1].trim() : 'unknown',
        connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : 0,
        totalKeys: keyCount,
      };
    } catch (error) {
      log.error('Failed to get Redis stats', error as Error);
      return { connected: false };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        log.info('Redis client disconnected gracefully');
      } catch (error) {
        log.error('Error during Redis cleanup', error as Error);
      }
      this.client = null;
      this.isConnected = false;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        return false;
      }
      
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}

// Singleton instance
let redisServiceInstance: RedisService | null = null;

export const getRedisService = (): RedisService => {
  if (!redisServiceInstance) {
    redisServiceInstance = new RedisService();
  }
  return redisServiceInstance;
};