import { TokyoOpenDataService } from '../TokyoOpenDataService';
import { OpenDataItem } from '@/types';

jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('TokyoOpenDataService', () => {
  let service: TokyoOpenDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokyoOpenDataService();
  });

  describe('searchDatasets', () => {
    const mockQuery = '公園';
    const mockLimit = 10;

    const mockApiResponse = {
      result: {
        count: 2,
        results: [
          {
            id: 'dataset-1',
            name: '東京都立公園一覧',
            title: '東京都立公園データ',
            notes: '東京都内の都立公園の情報を含むデータセット',
            tags: [
              { name: '公園' },
              { name: '東京' },
              { name: '都立' },
            ],
            organization: {
              name: '東京都',
            },
            resources: [
              {
                id: 'resource-1',
                name: '公園リスト',
                url: 'https://example.com/parks.csv',
                format: 'CSV',
                created: '2024-01-01T00:00:00.000Z',
              },
            ],
            metadata_created: '2024-01-01T00:00:00.000Z',
            metadata_modified: '2024-01-02T00:00:00.000Z',
          },
          {
            id: 'dataset-2',
            name: '区立公園施設情報',
            title: '23区公園データ',
            notes: '東京23区の区立公園施設に関する詳細情報',
            tags: [
              { name: '公園' },
              { name: '区立' },
              { name: '施設' },
            ],
            organization: {
              name: '東京都',
            },
            resources: [
              {
                id: 'resource-2',
                name: '施設詳細',
                url: 'https://example.com/facilities.json',
                format: 'JSON',
                created: '2024-01-01T00:00:00.000Z',
              },
            ],
            metadata_created: '2024-01-01T00:00:00.000Z',
            metadata_modified: '2024-01-02T00:00:00.000Z',
          },
        ],
      },
    };

    it('should search datasets successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await service.searchDatasets(mockQuery, mockLimit);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('東京都立公園データ');
      expect(result[0].category).toBe('公園・緑地');
      expect(result[0].tags).toContain('公園');
      expect(result[0].source).toBe('tokyo-open-data');
      expect(result[0].format).toBe('csv');
    });

    it('should handle API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.searchDatasets(mockQuery, mockLimit);

      expect(result).toHaveLength(0);
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.searchDatasets(mockQuery, mockLimit);

      expect(result).toHaveLength(0);
    });

    it('should handle empty results', async () => {
      const emptyResponse = {
        result: {
          count: 0,
          results: [],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(emptyResponse),
      });

      const result = await service.searchDatasets(mockQuery, mockLimit);

      expect(result).toHaveLength(0);
    });

    it('should normalize query parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { count: 0, results: [] } }),
      });

      await service.searchDatasets('東京 公園', 5);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const url = new URL(fetchCall[0]);
      
      expect(url.searchParams.get('q')).toContain('東京');
      expect(url.searchParams.get('q')).toContain('公園');
      expect(url.searchParams.get('rows')).toBe('5');
    });

    it('should extract search parameters correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { count: 0, results: [] } }),
      });

      await service.searchDatasets('渋谷区の人口データ 2024年', 10);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const url = new URL(fetchCall[0]);
      const query = url.searchParams.get('q');
      
      expect(query).toContain('渋谷区');
      expect(query).toContain('人口');
      expect(query).toContain('2024');
    });
  });

  describe('getDatasetDetails', () => {
    const mockDatasetId = 'dataset-123';
    const mockDatasetResponse = {
      result: {
        id: mockDatasetId,
        name: 'test-dataset',
        title: 'テストデータセット',
        notes: '詳細な説明',
        tags: [{ name: 'テスト' }],
        organization: { name: '東京都' },
        resources: [
          {
            id: 'resource-1',
            name: 'データファイル',
            url: 'https://example.com/data.csv',
            format: 'CSV',
            created: '2024-01-01T00:00:00.000Z',
          },
        ],
        metadata_created: '2024-01-01T00:00:00.000Z',
        metadata_modified: '2024-01-02T00:00:00.000Z',
      },
    };

    it('should get dataset details successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDatasetResponse),
      });

      const result = await service.getDatasetDetails(mockDatasetId);

      expect(result?.id).toBe(mockDatasetId);
      expect(result?.title).toBe('テストデータセット');
      expect(result?.source).toBe('tokyo-open-data');
    });

    it('should handle dataset not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await service.getDatasetDetails(mockDatasetId);

      expect(result).toBeNull();
    });
  });

  describe('categorizeDataset', () => {
    it('should categorize datasets correctly', () => {
      const testCases = [
        { tags: ['公園', '緑地'], expected: '公園・緑地' },
        { tags: ['人口', '統計'], expected: '人口・統計' },
        { tags: ['交通', '電車'], expected: '交通' },
        { tags: ['教育', '学校'], expected: '教育' },
        { tags: ['医療', '病院'], expected: '医療・健康' },
        { tags: ['環境', '大気'], expected: '環境' },
        { tags: ['災害', '防災'], expected: '防災・安全' },
        { tags: ['経済', 'GDP'], expected: '経済・産業' },
        { tags: ['文化', '観光'], expected: '文化・観光' },
        { tags: ['行政', '手続き'], expected: '行政・手続き' },
        { tags: ['不明', 'テスト'], expected: 'その他' },
      ];

      testCases.forEach(({ tags, expected }) => {
        const category = (service as any).categorizeDataset(tags);
        expect(category).toBe(expected);
      });
    });
  });

  describe('extractRelevantKeywords', () => {
    it('should extract relevant keywords from query', () => {
      const testCases = [
        {
          query: '渋谷区の公園情報を教えて',
          expected: ['渋谷区', '公園', '情報'],
        },
        {
          query: '2024年の人口統計データ',
          expected: ['2024年', '人口', '統計', 'データ'],
        },
        {
          query: '東京都の交通機関について',
          expected: ['東京都', '交通', '機関'],
        },
      ];

      testCases.forEach(({ query, expected }) => {
        const keywords = (service as any).extractRelevantKeywords(query);
        expected.forEach(keyword => {
          expect(keywords).toContain(keyword);
        });
      });
    });
  });

  describe('searchWithFilters', () => {
    const mockFilters = {
      category: '公園・緑地',
      organization: '東京都',
      format: 'CSV',
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      },
    };

    it('should apply filters to search', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { count: 0, results: [] } }),
      });

      await service.searchWithFilters('公園', mockFilters, 10);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const url = new URL(fetchCall[0]);
      
      expect(url.searchParams.get('fq')).toContain('organization:東京都');
    });
  });

  describe('getPopularDatasets', () => {
    it('should return popular datasets', async () => {
      const mockPopularResponse = {
        result: {
          count: 3,
          results: [
            {
              id: 'popular-1',
              name: '人気データセット1',
              title: '人気1',
              notes: '説明1',
              tags: [{ name: 'popular' }],
              organization: { name: '東京都' },
              resources: [],
              metadata_created: '2024-01-01T00:00:00.000Z',
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPopularResponse),
      });

      const result = await service.getPopularDatasets(5);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('人気1');
    });
  });

  describe('getRecentDatasets', () => {
    it('should return recent datasets', async () => {
      const mockRecentResponse = {
        result: {
          count: 2,
          results: [
            {
              id: 'recent-1',
              name: '最新データセット',
              title: '最新データ',
              notes: '最新の説明',
              tags: [{ name: 'new' }],
              organization: { name: '東京都' },
              resources: [],
              metadata_created: '2024-01-01T00:00:00.000Z',
              metadata_modified: '2024-01-02T00:00:00.000Z',
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRecentResponse),
      });

      const result = await service.getRecentDatasets(5);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('最新データ');
    });
  });

  describe('caching', () => {
    it('should cache search results', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { count: 0, results: [] } }),
      });

      // First call
      await service.searchDatasets('test', 10);
      // Second call (should use cache)
      await service.searchDatasets('test', 10);

      // Should only call API once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle malformed API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      const result = await service.searchDatasets('test', 10);

      expect(result).toHaveLength(0);
    });

    it('should handle timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await service.searchDatasets('test', 10);

      expect(result).toHaveLength(0);
    });
  });

  describe('data conversion', () => {
    it('should convert dataset to OpenDataItem correctly', () => {
      const mockDataset = {
        id: 'test-id',
        name: 'test-name',
        title: 'テストタイトル',
        notes: 'テスト説明',
        tags: [{ name: 'tag1' }, { name: 'tag2' }],
        organization: { name: 'テスト組織' },
        resources: [
          {
            id: 'res-1',
            name: 'リソース1',
            url: 'https://example.com/data.csv',
            format: 'CSV',
            created: '2024-01-01T00:00:00.000Z',
          },
        ],
        metadata_created: '2024-01-01T00:00:00.000Z',
        metadata_modified: '2024-01-02T00:00:00.000Z',
      };

      const result = (service as any).convertToOpenDataItem(mockDataset);

      expect(result.id).toBe('test-id');
      expect(result.title).toBe('テストタイトル');
      expect(result.description).toBe('テスト説明');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.source).toBe('tokyo-open-data');
      expect(result.format).toBe('csv');
    });
  });
});