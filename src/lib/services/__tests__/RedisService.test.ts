import { RedisService } from '../RedisService';
import { SessionData, ChatMessage } from '@/types';

jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Redis client
const mockRedisClient = {
  ping: jest.fn(),
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  rpush: jest.fn(),
  lrange: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

// Mock Redis constructor
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('RedisService', () => {
  let service: RedisService;
  const mockConfig = {
    host: 'localhost',
    port: 6379,
    password: 'test-password',
    db: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.ping.mockResolvedValue('PONG');
    service = new RedisService(mockConfig);
  });

  afterEach(async () => {
    await service.disconnect();
  });

  describe('initialization', () => {
    it('should initialize Redis client', () => {
      expect(service).toBeInstanceOf(RedisService);
    });

    it('should handle connection events', () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });

  describe('connection management', () => {
    it('should check if Redis is available', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const isAvailable = await service.isAvailable();

      expect(isAvailable).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should return false when Redis is not available', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const isAvailable = await service.isAvailable();

      expect(isAvailable).toBe(false);
    });

    it('should disconnect properly', async () => {
      await service.disconnect();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    const mockSessionId = 'test-session-123';
    const mockSessionData: SessionData = {
      id: mockSessionId,
      userId: 'user-123',
      createdAt: new Date(),
      lastActivity: new Date(),
      language: 'ja',
      context: { theme: 'light' },
      messageCount: 0,
    };

    it('should store session successfully', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await service.storeSession(mockSessionId, mockSessionData);

      expect(result.success).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `session:${mockSessionId}`,
        expect.any(Number),
        JSON.stringify(mockSessionData)
      );
    });

    it('should handle session storage failure', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis error'));

      const result = await service.storeSession(mockSessionId, mockSessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to store session');
    });

    it('should retrieve session successfully', async () => {
      const serializedSession = JSON.stringify(mockSessionData);
      mockRedisClient.get.mockResolvedValue(serializedSession);

      const result = await service.getSession(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(mockSessionId);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${mockSessionId}`);
    });

    it('should handle missing session', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getSession(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should handle corrupted session data', async () => {
      mockRedisClient.get.mockResolvedValue('invalid-json');

      const result = await service.getSession(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse session data');
    });

    it('should delete session successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.deleteSession(mockSessionId);

      expect(result.success).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${mockSessionId}`);
    });

    it('should handle session deletion failure', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await service.deleteSession(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to delete session');
    });
  });

  describe('message management', () => {
    const mockSessionId = 'test-session-123';
    const mockMessage: ChatMessage = {
      id: 'msg-123',
      role: 'user',
      content: 'テストメッセージ',
      timestamp: new Date(),
    };

    it('should add message successfully', async () => {
      mockRedisClient.rpush.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);

      const result = await service.addMessage(mockSessionId, mockMessage);

      expect(result.success).toBe(true);
      expect(mockRedisClient.rpush).toHaveBeenCalledWith(
        `messages:${mockSessionId}`,
        JSON.stringify(mockMessage)
      );
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });

    it('should handle message addition failure', async () => {
      mockRedisClient.rpush.mockRejectedValue(new Error('Redis error'));

      const result = await service.addMessage(mockSessionId, mockMessage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to add message');
    });

    it('should get messages successfully', async () => {
      const serializedMessages = [JSON.stringify(mockMessage)];
      mockRedisClient.lrange.mockResolvedValue(serializedMessages);

      const result = await service.getMessages(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].id).toBe(mockMessage.id);
      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        `messages:${mockSessionId}`,
        0,
        -1
      );
    });

    it('should get messages with limit', async () => {
      const serializedMessages = [JSON.stringify(mockMessage)];
      mockRedisClient.lrange.mockResolvedValue(serializedMessages);

      await service.getMessages(mockSessionId, 10);

      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        `messages:${mockSessionId}`,
        -10,
        -1
      );
    });

    it('should handle missing messages', async () => {
      mockRedisClient.lrange.mockResolvedValue([]);

      const result = await service.getMessages(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle corrupted message data', async () => {
      mockRedisClient.lrange.mockResolvedValue(['invalid-json']);

      const result = await service.getMessages(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse messages');
    });
  });

  describe('cache operations', () => {
    const cacheKey = 'test-cache-key';
    const cacheData = { test: 'data' };

    it('should set cache successfully', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await service.setCache(cacheKey, cacheData, 3600);

      expect(result.success).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `cache:${cacheKey}`,
        3600,
        JSON.stringify(cacheData)
      );
    });

    it('should get cache successfully', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cacheData));

      const result = await service.getCache(cacheKey);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cacheData);
    });

    it('should handle cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getCache(cacheKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cache miss');
    });

    it('should delete cache successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.deleteCache(cacheKey);

      expect(result.success).toBe(true);
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should return unhealthy status on error', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection error'));

      const health = await service.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('Connection error');
    });
  });

  describe('fallback behavior', () => {
    it('should handle Redis unavailability gracefully', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis unavailable'));
      
      const result = await service.storeSession('test', mockSessionData);

      expect(result.success).toBe(false);
      expect(result.usedFallback).toBe(true);
    });
  });
});