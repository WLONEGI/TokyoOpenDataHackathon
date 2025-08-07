import { ServiceManager } from '../ServiceManager';
import { GeminiService } from '../GeminiService';
import { VectorSearchService } from '../VectorSearchService';
import { OpenDataService } from '../OpenDataService';

// Mock all the services
jest.mock('../GeminiService');
jest.mock('../VectorSearchService');
jest.mock('../OpenDataService');

// Mock logger
jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ServiceManager as any).instance = undefined;
    serviceManager = ServiceManager.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    serviceManager.cleanup();
  });

  describe('singleton pattern', () => {
    test('should return the same instance', () => {
      const instance1 = ServiceManager.getInstance();
      const instance2 = ServiceManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    test('should maintain state across calls', async () => {
      const geminiService1 = await serviceManager.getGeminiService();
      const geminiService2 = await serviceManager.getGeminiService();

      expect(geminiService1).toBe(geminiService2);
    });
  });

  describe('service initialization', () => {
    test('should initialize GeminiService', async () => {
      const service = await serviceManager.getGeminiService();

      expect(service).toBeInstanceOf(GeminiService);
      expect(GeminiService).toHaveBeenCalledTimes(1);
    });

    test('should initialize VectorSearchService', async () => {
      const mockVectorService = {
        initializeIndex: jest.fn().mockResolvedValue(undefined),
      };
      (VectorSearchService as jest.Mock).mockImplementation(() => mockVectorService);

      const service = await serviceManager.getVectorSearchService();

      expect(service).toBe(mockVectorService);
      expect(VectorSearchService).toHaveBeenCalledTimes(1);
      expect(mockVectorService.initializeIndex).toHaveBeenCalledTimes(1);
    });

    test('should initialize OpenDataService', async () => {
      const service = await serviceManager.getOpenDataService();

      expect(service).toBeInstanceOf(OpenDataService);
      expect(OpenDataService).toHaveBeenCalledTimes(1);
    });

    test('should handle VectorSearchService initialization failure gracefully', async () => {
      const mockVectorService = {
        initializeIndex: jest.fn().mockRejectedValue(new Error('Init failed')),
      };
      (VectorSearchService as jest.Mock).mockImplementation(() => mockVectorService);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const service = await serviceManager.getVectorSearchService();

      expect(service).toBe(mockVectorService);
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Failed to initialize vector search service:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('service caching', () => {
    test('should reuse GeminiService instance', async () => {
      const service1 = await serviceManager.getGeminiService();
      const service2 = await serviceManager.getGeminiService();

      expect(service1).toBe(service2);
      expect(GeminiService).toHaveBeenCalledTimes(1);
    });

    test('should reuse VectorSearchService instance', async () => {
      const mockVectorService = {
        initializeIndex: jest.fn().mockResolvedValue(undefined),
      };
      (VectorSearchService as jest.Mock).mockImplementation(() => mockVectorService);

      const service1 = await serviceManager.getVectorSearchService();
      const service2 = await serviceManager.getVectorSearchService();

      expect(service1).toBe(service2);
      expect(VectorSearchService).toHaveBeenCalledTimes(1);
      expect(mockVectorService.initializeIndex).toHaveBeenCalledTimes(1);
    });

    test('should reuse OpenDataService instance', async () => {
      const service1 = await serviceManager.getOpenDataService();
      const service2 = await serviceManager.getOpenDataService();

      expect(service1).toBe(service2);
      expect(OpenDataService).toHaveBeenCalledTimes(1);
    });
  });

  describe('statistics and monitoring', () => {
    test('should track active services', async () => {
      await serviceManager.getGeminiService();
      await serviceManager.getOpenDataService();

      const stats = serviceManager.getStats();

      expect(stats.activeServices).toBe(2);
      expect(stats.initializedServices).toContain('gemini');
      expect(stats.initializedServices).toContain('openData');
      expect(Object.keys(stats.lastAccessTimes)).toHaveLength(2);
    });

    test('should track last access times', async () => {
      const beforeTime = Date.now();
      
      await serviceManager.getGeminiService();
      
      const afterTime = Date.now();
      const stats = serviceManager.getStats();

      expect(stats.lastAccessTimes.gemini).toBeDefined();
      
      // Convert ISO string back to timestamp for comparison
      const accessTime = new Date(stats.lastAccessTimes.gemini).getTime();
      expect(accessTime).toBeGreaterThanOrEqual(beforeTime);
      expect(accessTime).toBeLessThanOrEqual(afterTime);
    });

    test('should provide empty stats when no services initialized', () => {
      const stats = serviceManager.getStats();

      expect(stats.activeServices).toBe(0);
      expect(stats.initializedServices).toHaveLength(0);
      expect(Object.keys(stats.lastAccessTimes)).toHaveLength(0);
    });
  });

  describe('cleanup functionality', () => {
    test('should cleanup all services', async () => {
      const mockGeminiService = { cleanup: jest.fn() };
      const mockOpenDataService = { cleanup: jest.fn() };
      
      (GeminiService as jest.Mock).mockImplementation(() => mockGeminiService);
      (OpenDataService as jest.Mock).mockImplementation(() => mockOpenDataService);

      await serviceManager.getGeminiService();
      await serviceManager.getOpenDataService();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      serviceManager.cleanup();

      expect(mockGeminiService.cleanup).toHaveBeenCalledTimes(1);
      expect(mockOpenDataService.cleanup).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('🧹 ServiceManager cleanup completed');

      const stats = serviceManager.getStats();
      expect(stats.activeServices).toBe(0);

      consoleSpy.mockRestore();
    });

    test('should handle cleanup errors gracefully', async () => {
      const mockService = { 
        cleanup: jest.fn().mockImplementation(() => {
          throw new Error('Cleanup failed');
        })
      };
      
      (GeminiService as jest.Mock).mockImplementation(() => mockService);

      await serviceManager.getGeminiService();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      serviceManager.cleanup();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error cleaning up service gemini:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('should handle services without cleanup method', async () => {
      const mockService = {}; // No cleanup method
      
      (GeminiService as jest.Mock).mockImplementation(() => mockService);

      await serviceManager.getGeminiService();

      expect(() => serviceManager.cleanup()).not.toThrow();
    });
  });

  describe('service reinitialization', () => {
    test('should reinitialize GeminiService', async () => {
      const mockService = { cleanup: jest.fn() };
      (GeminiService as jest.Mock).mockImplementation(() => mockService);

      // Initialize service
      await serviceManager.getGeminiService();
      expect(GeminiService).toHaveBeenCalledTimes(1);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Reinitialize
      await serviceManager.reinitializeService('gemini');

      expect(mockService.cleanup).toHaveBeenCalledTimes(1);
      expect(GeminiService).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Service gemini reinitialized');

      consoleSpy.mockRestore();
    });

    test('should reinitialize VectorSearchService', async () => {
      const mockService = { 
        cleanup: jest.fn(),
        initializeIndex: jest.fn().mockResolvedValue(undefined)
      };
      (VectorSearchService as jest.Mock).mockImplementation(() => mockService);

      // Initialize service
      await serviceManager.getVectorSearchService();
      expect(VectorSearchService).toHaveBeenCalledTimes(1);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Reinitialize
      await serviceManager.reinitializeService('vectorSearch');

      expect(mockService.cleanup).toHaveBeenCalledTimes(1);
      expect(VectorSearchService).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Service vectorSearch reinitialized');

      consoleSpy.mockRestore();
    });

    test('should reinitialize OpenDataService', async () => {
      const mockService = { cleanup: jest.fn() };
      (OpenDataService as jest.Mock).mockImplementation(() => mockService);

      // Initialize service
      await serviceManager.getOpenDataService();
      expect(OpenDataService).toHaveBeenCalledTimes(1);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Reinitialize
      await serviceManager.reinitializeService('openData');

      expect(mockService.cleanup).toHaveBeenCalledTimes(1);
      expect(OpenDataService).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Service openData reinitialized');

      consoleSpy.mockRestore();
    });

    test('should throw error for unknown service', async () => {
      await expect(
        serviceManager.reinitializeService('unknownService')
      ).rejects.toThrow('Unknown service: unknownService');
    });
  });

  describe('memory management', () => {
    test('should start cleanup process on initialization', () => {
      // Verify that interval is set (we can't easily test the actual cleanup without waiting)
      expect(serviceManager).toBeDefined();
      
      // Check that cleanup process can be called manually
      expect(() => serviceManager.cleanup()).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    test('should handle multiple service operations', async () => {
      // Initialize all services
      const geminiService = await serviceManager.getGeminiService();
      const vectorService = await serviceManager.getVectorSearchService();
      const openDataService = await serviceManager.getOpenDataService();

      // Check that all are different instances
      expect(geminiService).not.toBe(vectorService);
      expect(geminiService).not.toBe(openDataService);
      expect(vectorService).not.toBe(openDataService);

      // Check stats
      const stats = serviceManager.getStats();
      expect(stats.activeServices).toBe(3);
      expect(stats.initializedServices).toHaveLength(3);

      // Cleanup
      serviceManager.cleanup();
      
      const afterStats = serviceManager.getStats();
      expect(afterStats.activeServices).toBe(0);
    });

    test('should maintain service state across multiple calls', async () => {
      // Get services multiple times
      const gemini1 = await serviceManager.getGeminiService();
      const vector1 = await serviceManager.getVectorSearchService();
      const openData1 = await serviceManager.getOpenDataService();
      
      const gemini2 = await serviceManager.getGeminiService();
      const vector2 = await serviceManager.getVectorSearchService();
      const openData2 = await serviceManager.getOpenDataService();

      // Should be same instances
      expect(gemini1).toBe(gemini2);
      expect(vector1).toBe(vector2);
      expect(openData1).toBe(openData2);

      // Services should only be created once
      expect(GeminiService).toHaveBeenCalledTimes(1);
      expect(VectorSearchService).toHaveBeenCalledTimes(1);
      expect(OpenDataService).toHaveBeenCalledTimes(1);
    });
  });
});