import Redis from 'redis';

class RedisService {
  private client: Redis.RedisClientType | null = null;
  private isConnecting = false;

  async getClient(): Promise<Redis.RedisClientType> {
    if (this.client?.isOpen) {
      return this.client;
    }

    if (this.isConnecting) {
      // 接続中の場合は少し待ってから再試行
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getClient();
    }

    this.isConnecting = true;

    try {
      this.client = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
        },
        retryStrategy: (retries) => {
          if (retries > 3) return false;
          return Math.min(retries * 50, 500);
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
      });

      this.client.on('disconnect', () => {
        console.log('Redis Client Disconnected');
      });

      await this.client.connect();
      this.isConnecting = false;
      return this.client;
    } catch (error) {
      this.isConnecting = false;
      console.error('Redis connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  // セッション管理
  async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    const client = await this.getClient();
    await client.setEx(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const client = await this.getClient();
      const data = await client.get(`session:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const client = await this.getClient();
    await client.del(`session:${sessionId}`);
  }

  async updateSessionAccess(sessionId: string): Promise<void> {
    const client = await this.getClient();
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastAccessedAt = new Date().toISOString();
      await this.setSession(sessionId, session);
    }
  }

  // キャッシュ管理
  async setCache(key: string, data: any, ttl: number = 300): Promise<void> {
    const client = await this.getClient();
    await client.setEx(`cache:${key}`, ttl, JSON.stringify(data));
  }

  async getCache(key: string): Promise<any | null> {
    try {
      const client = await this.getClient();
      const data = await client.get(`cache:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  async deleteCache(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(`cache:${key}`);
  }

  // パターンマッチによる削除
  async deleteCachePattern(pattern: string): Promise<number> {
    const client = await this.getClient();
    const keys = await client.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      return await client.del(keys);
    }
    return 0;
  }

  // レート制限
  async checkRateLimit(
    identifier: string, 
    windowSize: number = 60, 
    maxRequests: number = 60
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const client = await this.getClient();
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - (windowSize * 1000);

    // 古いエントリを削除
    await client.zRemRangeByScore(key, 0, windowStart);

    // 現在の要求数を取得
    const currentCount = await client.zCard(key);

    if (currentCount >= maxRequests) {
      const oldestRequest = await client.zRange(key, 0, 0, { withScores: true });
      const resetTime = oldestRequest.length > 0 
        ? Math.ceil((Number(oldestRequest[0].score) + windowSize * 1000) / 1000)
        : Math.ceil((now + windowSize * 1000) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // 新しいリクエストを記録
    await client.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
    await client.expire(key, windowSize);

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetTime: Math.ceil((now + windowSize * 1000) / 1000),
    };
  }

  // ヘルスチェック
  async healthCheck(): Promise<{ status: string; responseTime: number }> {
    const start = Date.now();
    try {
      const client = await this.getClient();
      await client.ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
      };
    }
  }
}

export default new RedisService();