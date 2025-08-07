import { SessionManager } from '../SessionManager';
import { RedisService } from '../RedisService';
import { SessionData, ChatMessage } from '@/types';

jest.mock('../RedisService');
jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedisService = new RedisService({} as any) as jest.Mocked<RedisService>;
    sessionManager = new SessionManager(mockRedisService);
  });

  describe('createSession', () => {
    const mockUserId = 'user-123';
    const mockLanguage = 'ja';

    it('should create session successfully', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.storeSession.mockResolvedValue({
        success: true,
        data: undefined,
      });

      const result = await sessionManager.createSession(mockUserId, mockLanguage);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(mockRedisService.storeSession).toHaveBeenCalled();
    });

    it('should create session with memory fallback when Redis unavailable', async () => {
      mockRedisService.isAvailable.mockResolvedValue(false);

      const result = await sessionManager.createSession(mockUserId, mockLanguage);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.usedFallback).toBe(true);
    });

    it('should handle session creation failure', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.storeSession.mockResolvedValue({
        success: false,
        error: 'Redis error',
        data: undefined,
      });

      const result = await sessionManager.createSession(mockUserId, mockLanguage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create session');
    });
  });

  describe('getSession', () => {
    const mockSessionId = 'test-session-123';
    const mockSessionData: SessionData = {
      id: mockSessionId,
      userId: 'user-123',
      createdAt: new Date(),
      lastActivity: new Date(),
      language: 'ja',
      context: {},
      messageCount: 0,
    };

    it('should get session from Redis successfully', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.getSession.mockResolvedValue({
        success: true,
        data: mockSessionData,
      });

      const result = await sessionManager.getSession(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(mockSessionId);
      expect(mockRedisService.getSession).toHaveBeenCalledWith(mockSessionId);
    });

    it('should get session from memory when Redis unavailable', async () => {
      // First create session in memory
      mockRedisService.isAvailable.mockResolvedValue(false);
      const createResult = await sessionManager.createSession('user-123', 'ja');
      
      const result = await sessionManager.getSession(createResult.sessionId!);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(createResult.sessionId);
      expect(result.usedFallback).toBe(true);
    });

    it('should handle session not found', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.getSession.mockResolvedValue({
        success: false,
        error: 'Session not found',
        data: undefined,
      });

      const result = await sessionManager.getSession('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('updateSession', () => {
    const mockSessionId = 'test-session-123';
    const mockUpdates = { messageCount: 5 };

    it('should update session successfully', async () => {
      const existingSession: SessionData = {
        id: mockSessionId,
        userId: 'user-123',
        createdAt: new Date(),
        lastActivity: new Date(),
        language: 'ja',
        context: {},
        messageCount: 0,
      };

      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.getSession.mockResolvedValue({
        success: true,
        data: existingSession,
      });
      mockRedisService.storeSession.mockResolvedValue({
        success: true,
        data: undefined,
      });

      const result = await sessionManager.updateSession(mockSessionId, mockUpdates);

      expect(result.success).toBe(true);
      expect(mockRedisService.storeSession).toHaveBeenCalled();
    });

    it('should handle update when session not found', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.getSession.mockResolvedValue({
        success: false,
        error: 'Session not found',
        data: undefined,
      });

      const result = await sessionManager.updateSession(mockSessionId, mockUpdates);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('deleteSession', () => {
    const mockSessionId = 'test-session-123';

    it('should delete session successfully', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.deleteSession.mockResolvedValue({
        success: true,
        data: undefined,
      });

      const result = await sessionManager.deleteSession(mockSessionId);

      expect(result.success).toBe(true);
      expect(mockRedisService.deleteSession).toHaveBeenCalledWith(mockSessionId);
    });

    it('should delete session from memory when Redis unavailable', async () => {
      // First create session in memory
      mockRedisService.isAvailable.mockResolvedValue(false);
      const createResult = await sessionManager.createSession('user-123', 'ja');
      
      const result = await sessionManager.deleteSession(createResult.sessionId!);

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
    });

    it('should handle deletion failure', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.deleteSession.mockResolvedValue({
        success: false,
        error: 'Delete failed',
        data: undefined,
      });

      const result = await sessionManager.deleteSession(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to delete session');
    });
  });

  describe('addMessage', () => {
    const mockSessionId = 'test-session-123';
    const mockMessage: ChatMessage = {
      id: 'msg-123',
      role: 'user',
      content: 'テストメッセージ',
      timestamp: new Date(),
    };

    it('should add message successfully', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.addMessage.mockResolvedValue({
        success: true,
        data: undefined,
      });

      const result = await sessionManager.addMessage(mockSessionId, mockMessage);

      expect(result.success).toBe(true);
      expect(mockRedisService.addMessage).toHaveBeenCalledWith(mockSessionId, mockMessage);
    });

    it('should add message to memory when Redis unavailable', async () => {
      mockRedisService.isAvailable.mockResolvedValue(false);

      const result = await sessionManager.addMessage(mockSessionId, mockMessage);

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
    });

    it('should handle message addition failure', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.addMessage.mockResolvedValue({
        success: false,
        error: 'Redis error',
        data: undefined,
      });

      const result = await sessionManager.addMessage(mockSessionId, mockMessage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to add message');
    });
  });

  describe('getMessages', () => {
    const mockSessionId = 'test-session-123';
    const mockMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date(),
      },
    ];

    it('should get messages successfully', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.getMessages.mockResolvedValue({
        success: true,
        data: mockMessages,
      });

      const result = await sessionManager.getMessages(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mockRedisService.getMessages).toHaveBeenCalledWith(mockSessionId, undefined);
    });

    it('should get messages with limit', async () => {
      mockRedisService.isAvailable.mockResolvedValue(true);
      mockRedisService.getMessages.mockResolvedValue({
        success: true,
        data: [mockMessages[0]],
      });

      await sessionManager.getMessages(mockSessionId, 1);

      expect(mockRedisService.getMessages).toHaveBeenCalledWith(mockSessionId, 1);
    });

    it('should get messages from memory when Redis unavailable', async () => {
      mockRedisService.isAvailable.mockResolvedValue(false);

      const result = await sessionManager.getMessages(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired sessions', async () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Create an expired session in memory
      mockRedisService.isAvailable.mockResolvedValue(false);
      const createResult = await sessionManager.createSession('user-123', 'ja');
      
      // Manually set the session as expired (simulate time passing)
      const session = (sessionManager as any).memorySessions.get(createResult.sessionId!);
      if (session) {
        session.lastActivity = expiredTime;
      }

      await sessionManager.cleanup();

      // Session should be removed
      const getResult = await sessionManager.getSession(createResult.sessionId!);
      expect(getResult.success).toBe(false);
    });
  });

  describe('health check', () => {
    it('should return health status', async () => {
      mockRedisService.getHealthStatus.mockResolvedValue({
        status: 'healthy',
        lastCheck: new Date(),
      });

      const health = await sessionManager.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.memorySessionCount).toBeDefined();
    });

    it('should handle Redis health check failure', async () => {
      mockRedisService.getHealthStatus.mockResolvedValue({
        status: 'unhealthy',
        error: 'Connection failed',
        lastCheck: new Date(),
      });

      const health = await sessionManager.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.error).toContain('Redis unhealthy');
    });
  });
});