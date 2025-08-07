import { VectorSearchService } from '../VectorSearchService';
import { OpenDataService } from '../OpenDataService';
import { VertexVectorSearchService } from '../VertexVectorSearchService';
import { SearchCache } from '@/lib/cache/SearchCache';
import { OpenDataItem } from '@/types';

jest.mock('../OpenDataService');
jest.mock('../VertexVectorSearchService');
jest.mock('@/lib/cache/SearchCache');
jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let mockOpenDataService: jest.Mocked<OpenDataService>;
  let mockVertexService: jest.Mocked<VertexVectorSearchService>;
  let mockSearchCache: jest.Mocked<SearchCache>;

  const mockConfig = {
    enableVertexSearch: true,
    cacheEnabled: true,
    maxResults: 50,
    minRelevanceScore: 0.1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOpenDataService = new OpenDataService() as jest.Mocked<OpenDataService>;
    mockVertexService = new VertexVectorSearchService({} as any) as jest.Mocked<VertexVectorSearchService>;
    mockSearchCache = new SearchCache() as jest.Mocked<SearchCache>;

    service = new VectorSearchService(mockOpenDataService, mockVertexService, mockConfig);
    (service as any).cache = mockSearchCache;
  });

  describe('initialization', () => {
    it('should initialize with services and config', () => {
      expect(service).toBeInstanceOf(VectorSearchService);
    });

    it('should use default config when not provided', () => {
      const defaultService = new VectorSearchService(mockOpenDataService, mockVertexService);
      expect(defaultService).toBeInstanceOf(VectorSearchService);
    });
  });

  describe('search', () => {
    const mockQuery = '東京の公園情報';
    const mockSessionId = 'test-session-123';

    const mockOpenDataResults: OpenDataItem[] = [
      {
        id: '1',
        title: '東京都立公園一覧',
        description: '東京都内の都立公園の情報',
        category: '公園・緑地',
        tags: ['公園', '東京', '都立'],
        source: 'tokyo-open-data',
        lastUpdated: new Date().toISOString(),
        dataUrl: 'https://example.com/parks',
        format: 'csv',
        content: '上野公園、代々木公園など',
        relevanceScore: 0.85,
      },
    ];

    const mockVertexResults = {
      items: [
        {
          id: '2',
          title: 'AI強化公園データ',
          description: 'ベクトル検索で見つけた公園情報',
          category: '公園・緑地',
          tags: ['公園', 'AI検索'],
          source: 'vertex-ai',
          lastUpdated: new Date().toISOString(),
          dataUrl: 'https://example.com/ai-parks',
          format: 'json',
          content: 'AI検索による公園データ',
          relevanceScore: 0.95,
        },
      ],
      metadata: {
        searchTime: 150,
        totalFound: 1,
        usedVertexAI: true,
      },
    };

    it('should search successfully with cache miss', async () => {
      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);
      mockVertexService.search.mockResolvedValue(mockVertexResults);
      mockSearchCache.set.mockReturnValue(undefined);

      const result = await service.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].relevanceScore).toBe(0.95); // Vertex AI result first (higher score)
      expect(result.items[1].relevanceScore).toBe(0.85); // OpenData result second
      expect(result.usedCache).toBe(false);
      expect(mockSearchCache.set).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      const cachedResult = {
        items: mockOpenDataResults,
        totalFound: 1,
        searchTime: 50,
        usedCache: true,
      };

      mockSearchCache.get.mockReturnValue(cachedResult);

      const result = await service.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(1);
      expect(result.usedCache).toBe(true);
      expect(result.searchTime).toBe(50);
      expect(mockOpenDataService.searchDatasets).not.toHaveBeenCalled();
      expect(mockVertexService.search).not.toHaveBeenCalled();
    });

    it('should handle search with limit', async () => {
      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);
      mockVertexService.search.mockResolvedValue(mockVertexResults);

      await service.search(mockQuery, mockSessionId, 5);

      expect(mockOpenDataService.searchDatasets).toHaveBeenCalledWith(mockQuery, 25); // 50% of limit
      expect(mockVertexService.search).toHaveBeenCalledWith(mockQuery, mockSessionId, 25);
    });

    it('should handle OpenData service failure gracefully', async () => {
      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockRejectedValue(new Error('OpenData API error'));
      mockVertexService.search.mockResolvedValue(mockVertexResults);

      const result = await service.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].source).toBe('vertex-ai');
    });

    it('should handle Vertex AI service failure gracefully', async () => {
      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);
      mockVertexService.search.mockRejectedValue(new Error('Vertex AI error'));

      const result = await service.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].source).toBe('tokyo-open-data');
    });

    it('should handle both services failing', async () => {
      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockRejectedValue(new Error('OpenData error'));
      mockVertexService.search.mockRejectedValue(new Error('Vertex error'));

      const result = await service.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(0);
      expect(result.error).toBe('All search services failed');
    });

    it('should filter results by relevance score', async () => {
      const lowScoreResults: OpenDataItem[] = [
        {
          ...mockOpenDataResults[0],
          relevanceScore: 0.05, // Below minimum threshold
        },
      ];

      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(lowScoreResults);
      mockVertexService.search.mockResolvedValue(mockVertexResults);

      const result = await service.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(1); // Only Vertex result should remain
      expect(result.items[0].source).toBe('vertex-ai');
    });

    it('should remove duplicates correctly', async () => {
      const duplicateResults = {
        items: [
          {
            ...mockVertexResults.items[0],
            id: '1', // Same ID as OpenData result
          },
        ],
        metadata: mockVertexResults.metadata,
      };

      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);
      mockVertexService.search.mockResolvedValue(duplicateResults);

      const result = await service.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(1); // Duplicate removed
    });

    it('should disable Vertex search when configured', async () => {
      const configWithoutVertex = { ...mockConfig, enableVertexSearch: false };
      const serviceWithoutVertex = new VectorSearchService(
        mockOpenDataService,
        mockVertexService,
        configWithoutVertex
      );
      (serviceWithoutVertex as any).cache = mockSearchCache;

      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);

      const result = await serviceWithoutVertex.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(1);
      expect(mockVertexService.search).not.toHaveBeenCalled();
    });

    it('should disable caching when configured', async () => {
      const configWithoutCache = { ...mockConfig, cacheEnabled: false };
      const serviceWithoutCache = new VectorSearchService(
        mockOpenDataService,
        mockVertexService,
        configWithoutCache
      );

      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);
      mockVertexService.search.mockResolvedValue(mockVertexResults);

      const result = await serviceWithoutCache.search(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(2);
      expect(result.usedCache).toBe(false);
      expect(mockSearchCache.get).not.toHaveBeenCalled();
      expect(mockSearchCache.set).not.toHaveBeenCalled();
    });
  });

  describe('searchWithFilters', () => {
    const mockFilters = {
      category: '公園・緑地',
      tags: ['公園'],
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      },
    };

    it('should apply filters to search results', async () => {
      const mixedResults: OpenDataItem[] = [
        {
          id: '1',
          title: '公園データ',
          description: '公園の情報',
          category: '公園・緑地',
          tags: ['公園'],
          source: 'tokyo-open-data',
          lastUpdated: '2024-06-01T00:00:00.000Z',
          dataUrl: 'https://example.com/parks',
          format: 'csv',
          relevanceScore: 0.9,
        },
        {
          id: '2',
          title: '交通データ',
          description: '交通の情報',
          category: '交通',
          tags: ['電車'],
          source: 'tokyo-open-data',
          lastUpdated: '2024-06-01T00:00:00.000Z',
          dataUrl: 'https://example.com/traffic',
          format: 'json',
          relevanceScore: 0.8,
        },
      ];

      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(mixedResults);
      mockVertexService.search.mockResolvedValue({ items: [], metadata: {} });

      const result = await service.searchWithFilters('データ', mockFilters, 'session-123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].category).toBe('公園・緑地');
      expect(result.items[0].tags).toContain('公園');
    });
  });

  describe('getRecommendations', () => {
    const mockUserProfile = {
      preferredCategories: ['公園・緑地', '交通'],
      recentSearches: ['公園', '電車'],
      language: 'ja' as const,
    };

    it('should return personalized recommendations', async () => {
      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);
      mockVertexService.search.mockResolvedValue(mockVertexResults);

      const result = await service.getRecommendations(mockUserProfile, 'session-123');

      expect(result.items.length).toBeGreaterThan(0);
      expect(mockOpenDataService.searchDatasets).toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear the search cache', async () => {
      mockSearchCache.clear.mockReturnValue(undefined);

      await service.clearCache();

      expect(mockSearchCache.clear).toHaveBeenCalled();
    });
  });

  describe('getSearchStats', () => {
    it('should return search statistics', () => {
      const stats = service.getSearchStats();

      expect(stats).toHaveProperty('totalSearches');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('vertexAIUsage');
    });
  });

  describe('utility methods', () => {
    it('should normalize query correctly', () => {
      const testCases = [
        { input: '東京の公園', expected: '東京 公園' },
        { input: '  multiple   spaces  ', expected: 'multiple spaces' },
        { input: '特殊文字！？', expected: '特殊文字' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = (service as any).normalizeQuery(input);
        expect(result).toBe(expected);
      });
    });

    it('should shuffle array correctly', () => {
      const originalArray = [1, 2, 3, 4, 5];
      const shuffled = (service as any).shuffleArray([...originalArray]);

      expect(shuffled).toHaveLength(originalArray.length);
      expect(shuffled.sort()).toEqual(originalArray.sort());
    });

    it('should merge and deduplicate results', () => {
      const results1 = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }];
      const results2 = [{ id: '2', title: 'B' }, { id: '3', title: 'C' }];

      const merged = (service as any).mergeAndDeduplicate(results1, results2);

      expect(merged).toHaveLength(3);
      expect(merged.map((r: any) => r.id)).toEqual(['1', '2', '3']);
    });
  });

  describe('error scenarios', () => {
    it('should handle invalid query gracefully', async () => {
      const result = await service.search('', 'session-123');

      expect(result.items).toHaveLength(0);
      expect(result.error).toBe('Invalid query');
    });

    it('should handle session ID validation', async () => {
      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue([]);
      mockVertexService.search.mockResolvedValue({ items: [], metadata: {} });

      const result = await service.search('test', '');

      expect(result.sessionId).toBeDefined();
    });
  });

  describe('performance optimizations', () => {
    it('should handle concurrent searches', async () => {
      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(mockOpenDataResults);
      mockVertexService.search.mockResolvedValue(mockVertexResults);

      const promises = [
        service.search('query1', 'session1'),
        service.search('query2', 'session2'),
        service.search('query3', 'session3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.items.length).toBeGreaterThan(0);
      });
    });

    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        title: `Title ${i}`,
        description: `Description ${i}`,
        category: '公園・緑地',
        tags: ['tag'],
        source: 'tokyo-open-data',
        lastUpdated: new Date().toISOString(),
        dataUrl: `https://example.com/${i}`,
        format: 'json',
        relevanceScore: 0.5 + (i / 200), // Varying scores
      }));

      mockSearchCache.get.mockReturnValue(null);
      mockOpenDataService.searchDatasets.mockResolvedValue(largeResultSet);
      mockVertexService.search.mockResolvedValue({ items: [], metadata: {} });

      const result = await service.search('test', 'session-123', 50);

      expect(result.items.length).toBeLessThanOrEqual(50);
    });
  });
});