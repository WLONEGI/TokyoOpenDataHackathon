import { VertexVectorSearchService } from '../VertexVectorSearchService';
import { SearchQuery } from '@/types';

jest.mock('@/lib/config', () => ({
  config: {
    gcpProjectId: 'test-project',
    gcpRegion: 'us-central1',
  },
}));

jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    VERTEX_INDEX_ENDPOINT_ID: 'test-endpoint-123',
    VERTEX_DEPLOYED_INDEX_ID: 'deployed-index-456',
    NODE_ENV: 'test',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

// Mock fetch globally
global.fetch = jest.fn();

describe('VertexVectorSearchService', () => {
  let service: VertexVectorSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VertexVectorSearchService();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(service).toBeInstanceOf(VertexVectorSearchService);
    });

    it('should initialize with proper configuration', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should handle missing project ID', async () => {
      // Temporarily modify the config
      const originalConfig = require('@/lib/config').config;
      require('@/lib/config').config.gcpProjectId = '';

      const invalidService = new VertexVectorSearchService();
      await expect(invalidService.initialize()).rejects.toThrow('GCP Project ID is required');

      // Restore original config
      require('@/lib/config').config.gcpProjectId = originalConfig.gcpProjectId;
    });

    it('should warn when Vertex configuration is missing', async () => {
      const originalEnv = process.env.VERTEX_INDEX_ENDPOINT_ID;
      delete process.env.VERTEX_INDEX_ENDPOINT_ID;

      const serviceWithoutConfig = new VertexVectorSearchService();
      await serviceWithoutConfig.initialize();

      expect(require('@/lib/logger').log.warn).toHaveBeenCalledWith(
        'Vertex Vector Search not configured, using fallback'
      );

      process.env.VERTEX_INDEX_ENDPOINT_ID = originalEnv;
    });
  });

  describe('search functionality', () => {
    const mockQuery: SearchQuery = {
      text: '東京の公園情報',
      language: 'ja',
      limit: 10,
    };

    it('should perform search successfully', async () => {
      // Mock embedding generation response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          predictions: [
            {
              embeddings: {
                values: Array.from({ length: 768 }, () => Math.random()),
              },
            },
          ],
        }),
      });

      // Mock vector search response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          nearest_neighbors: [
            {
              neighbors: [
                {
                  id: 'result-1',
                  distance: 0.15,
                  datapoint: {
                    datapoint_id: 'datapoint-1',
                    feature_vector: [],
                  },
                },
              ],
            },
          ],
        }),
      });

      const result = await service.search(mockQuery);

      expect(result.items).toHaveLength(1);
      expect(result.query).toBe(mockQuery.text);
      expect(result.total).toBeGreaterThan(0);
      expect(result.usedCache).toBe(false);
    });

    it('should handle embedding generation failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await service.search(mockQuery);

      // Should fallback to basic search
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('fallback-search-1');
    });

    it('should handle vector search failure', async () => {
      // Mock successful embedding generation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          predictions: [
            {
              embeddings: {
                values: Array.from({ length: 768 }, () => Math.random()),
              },
            },
          ],
        }),
      });

      // Mock failed vector search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.search(mockQuery);

      // Should fallback to basic search
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('fallback-search-1');
    });

    it('should use fallback when not initialized', async () => {
      delete process.env.VERTEX_INDEX_ENDPOINT_ID;
      const uninitializedService = new VertexVectorSearchService();

      const result = await uninitializedService.search(mockQuery);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('fallback-search-1');
      expect(require('@/lib/logger').log.warn).toHaveBeenCalledWith(
        'Using fallback search due to Vertex AI unavailability'
      );

      process.env.VERTEX_INDEX_ENDPOINT_ID = 'test-endpoint-123';
    });

    it('should generate fallback embedding', async () => {
      const fallbackEmbedding = (service as any).generateFallbackEmbedding('テスト文書');

      expect(fallbackEmbedding).toHaveLength(768);
      expect(fallbackEmbedding.every((val: number) => typeof val === 'number')).toBe(true);
      
      // Check normalization (magnitude should be close to 1)
      const magnitude = Math.sqrt(fallbackEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1, 1);
    });
  });

  describe('recommendations', () => {
    it('should get recommendations successfully', async () => {
      // Mock the search method
      jest.spyOn(service, 'search').mockResolvedValue({
        items: [
          {
            id: 'rec-1',
            title: 'おすすめ情報1',
            description: 'おすすめの説明',
            category: 'childcare',
            tags: ['おすすめ'],
            content: 'おすすめの内容',
            metadata: {
              source: 'Vertex AI',
              lastUpdated: new Date(),
              language: 'ja',
            },
          },
        ],
        total: 1,
        query: '子育て支援',
        processingTime: 100,
        usedCache: false,
      });

      const recommendations = await service.getRecommendations('子育て', 3);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].title).toBe('おすすめ情報1');
    });

    it('should handle recommendations failure', async () => {
      jest.spyOn(service, 'search').mockRejectedValue(new Error('Search failed'));

      const recommendations = await service.getRecommendations('テスト');

      expect(recommendations).toHaveLength(0);
      expect(require('@/lib/logger').log.error).toHaveBeenCalledWith(
        'Failed to get Vertex AI recommendations',
        expect.any(Error)
      );
    });
  });

  describe('token management', () => {
    it('should refresh access token in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      await (service as any).refreshAccessToken();

      expect((service as any).accessToken).toBe('dev-mode-token');
      expect((service as any).tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('should refresh access token in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      await (service as any).refreshAccessToken();

      expect((service as any).accessToken).toBe('placeholder-token');
      expect((service as any).tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('should ensure valid token before API calls', async () => {
      const refreshSpy = jest.spyOn(service as any, 'refreshAccessToken');
      
      // Set expired token
      (service as any).accessToken = 'expired-token';
      (service as any).tokenExpiry = Date.now() - 1000;

      await (service as any).ensureValidToken();

      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('sample result generation', () => {
    it('should generate sample results based on query', () => {
      const mockQuery: SearchQuery = {
        text: '公園 遊具',
        language: 'ja',
        category: 'recreation',
      };

      const sampleResults = (service as any).generateSampleResults(mockQuery, 3);

      expect(sampleResults).toHaveLength(3);
      sampleResults.forEach((result: any, index: number) => {
        expect(result.id).toBe(`vertex-result-${index}`);
        expect(result.title).toContain('公園');
        expect(result.category).toBe('recreation');
        expect(result.tags).toContain('Vertex AI');
      });
    });

    it('should limit sample results correctly', () => {
      const mockQuery: SearchQuery = {
        text: 'テスト',
        language: 'ja',
      };

      const sampleResults = (service as any).generateSampleResults(mockQuery, 10);

      // Should be limited to 5 even if count is 10
      expect(sampleResults).toHaveLength(5);
    });
  });

  describe('fallback search', () => {
    it('should perform fallback search', async () => {
      const mockQuery: SearchQuery = {
        text: 'テスト検索',
        language: 'ja',
        category: 'test',
      };

      const result = await (service as any).fallbackSearch(mockQuery);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('fallback-search-1');
      expect(result.items[0].title).toContain('テスト');
      expect(result.query).toBe(mockQuery.text);
      expect(result.usedCache).toBe(false);
      expect(require('@/lib/logger').log.warn).toHaveBeenCalledWith(
        'Using fallback search due to Vertex AI unavailability'
      );
    });
  });

  describe('service statistics', () => {
    it('should return service stats', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('isInitialized');
      expect(stats).toHaveProperty('hasValidToken');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('provider');
      expect(stats).toHaveProperty('capabilities');
      expect(stats.provider).toBe('Google Cloud Vertex AI Vector Search');
      expect(stats.capabilities).toContain('semantic_search');
    });
  });

  describe('cleanup', () => {
    it('should cleanup service properly', async () => {
      await service.initialize();

      await service.cleanup();

      const stats = service.getStats();
      expect(stats.isInitialized).toBe(false);
      expect(stats.hasValidToken).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const mockQuery: SearchQuery = {
        text: 'テスト',
        language: 'ja',
      };

      const result = await service.search(mockQuery);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('fallback-search-1');
    });

    it('should handle malformed API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}), // Malformed response
      });

      const mockQuery: SearchQuery = {
        text: 'テスト',
        language: 'ja',
      };

      const result = await service.search(mockQuery);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('fallback-search-1');
    });
  });

  describe('embedding processing', () => {
    it('should handle various text inputs for embedding', () => {
      const testCases = [
        '短いテキスト',
        'これは非常に長いテキストの例です。複数の単語と文が含まれており、様々な文字が使用されています。',
        'English text with Japanese 日本語 mixed',
        '12345 数字 symbols !@#$%',
        '',
      ];

      testCases.forEach(text => {
        const embedding = (service as any).generateFallbackEmbedding(text);
        expect(embedding).toHaveLength(768);
        expect(embedding.every((val: number) => typeof val === 'number' && !isNaN(val))).toBe(true);
      });
    });
  });
});