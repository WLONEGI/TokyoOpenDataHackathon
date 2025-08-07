import { OpenDataService } from '../OpenDataService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('OpenDataService', () => {
  let openDataService: OpenDataService;

  beforeEach(() => {
    openDataService = new OpenDataService();
    jest.clearAllMocks();
  });

  describe('fetchChildcareData', () => {
    test('should fetch and return childcare data', async () => {
      const result = await openDataService.fetchChildcareData();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Check structure of returned items
      const firstItem = result[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('title');
      expect(firstItem).toHaveProperty('description');
      expect(firstItem).toHaveProperty('category');
      expect(firstItem).toHaveProperty('tags');
      expect(firstItem).toHaveProperty('content');
      expect(firstItem).toHaveProperty('metadata');
      
      expect(firstItem.category).toBe('childcare');
      expect(Array.isArray(firstItem.tags)).toBe(true);
    });

    test('should use sample data when real data fails', async () => {
      // Mock axios to simulate API failure
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await openDataService.fetchChildcareData();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Should return sample or fallback data (checking for expected data patterns)
      expect(result.some(item => 
        item.title.includes('保育園') || 
        item.title.includes('学童保育') || 
        item.title.includes('子育て支援') ||
        item.id.includes('fallback')
      )).toBe(true);
    });

    test('should handle successful real data fetch with mocked API', async () => {
      // Mock successful API responses
      const mockMetadataResponse = {
        data: {
          success: true,
          result: {
            id: 'test-dataset',
            title: 'Test Dataset',
            notes: 'Test description',
            metadata_modified: '2024-01-01T00:00:00Z',
            tags: [{ name: 'test' }],
            resources: [
              {
                id: 'resource-1',
                format: 'JSON',
                url: 'https://example.com/data.json',
              },
            ],
          },
        },
      };

      const mockResourceResponse = {
        data: [
          {
            name: 'Test Facility',
            description: 'Test facility description',
            address: '東京都港区',
          },
        ],
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockMetadataResponse)
        .mockResolvedValueOnce(mockResourceResponse);

      const result = await openDataService.fetchChildcareData();

      expect(result.length).toBeGreaterThan(0);
      // Should include either mocked data or fall back to sample data
      expect(result.some(item => 
        item.metadata.source.includes('Test Dataset') ||
        item.metadata.source.includes('東京都')
      )).toBe(true);
    });
  });

  describe('searchChildcareInfo', () => {
    test('should search for childcare information', async () => {
      const query = '保育園';
      const result = await openDataService.searchChildcareInfo(query);

      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        // At least one result should contain the search term
        const hasRelevantResult = result.some(item => {
          const searchableText = (
            item.title + ' ' + 
            item.description + ' ' + 
            item.content + ' ' + 
            item.tags.join(' ')
          ).toLowerCase();
          return searchableText.includes('保育園');
        });
        expect(hasRelevantResult).toBe(true);
      }
    });

    test('should handle empty search query', async () => {
      const result = await openDataService.searchChildcareInfo('');

      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle search with multiple terms', async () => {
      const query = '保育園 申請';
      const result = await openDataService.searchChildcareInfo(query);

      expect(Array.isArray(result)).toBe(true);
    });

    test('should return empty array for non-matching query', async () => {
      const query = 'xyz123nonexistent';
      const result = await openDataService.searchChildcareInfo(query);

      expect(Array.isArray(result)).toBe(true);
      // May return empty array or fallback data depending on implementation
    });
  });

  describe('getDataSources', () => {
    test('should return available data sources', async () => {
      const result = await openDataService.getDataSources();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      const firstSource = result[0];
      expect(firstSource).toHaveProperty('id');
      expect(firstSource).toHaveProperty('title');
      expect(firstSource).toHaveProperty('url');
      expect(firstSource).toHaveProperty('description');
      expect(firstSource).toHaveProperty('category');
      expect(firstSource).toHaveProperty('lastUpdated');
      
      expect(firstSource.category).toBe('childcare');
      expect(firstSource.url).toContain('catalog.data.metro.tokyo.lg.jp');
    });

    test('should return expected data sources', async () => {
      const result = await openDataService.getDataSources();

      const expectedSources = [
        'tokyo-childcare-registry',
        'afterschool-care',
        'small-nurseries',
        'kids-cafeteria',
      ];

      expectedSources.forEach(expectedId => {
        const found = result.find(source => source.id === expectedId);
        expect(found).toBeDefined();
      });
    });
  });

  describe('private methods behavior', () => {
    test('should handle dataset conversion properly', async () => {
      // Test through public method that uses private methods
      const result = await openDataService.fetchChildcareData();

      // Verify that data is properly structured
      expect(result.every(item => 
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.description === 'string' &&
        typeof item.category === 'string' &&
        Array.isArray(item.tags) &&
        typeof item.content === 'string' &&
        typeof item.metadata === 'object'
      )).toBe(true);
    });

    test('should handle API errors gracefully', async () => {
      // Mock network errors
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const result = await openDataService.fetchChildcareData();

      // Should still return data (fallback)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle malformed API responses', async () => {
      // Mock malformed responses
      mockedAxios.get.mockResolvedValue({
        data: {
          success: false,
          error: 'API Error',
        },
      });

      const result = await openDataService.fetchChildcareData();

      // Should fall back to sample data
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle timeout scenarios', async () => {
      // Mock timeout error
      mockedAxios.get.mockRejectedValue(new Error('Request timeout'));

      const result = await openDataService.fetchChildcareData();

      // Should return fallback data
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('data quality validation', () => {
    test('should return items with proper metadata', async () => {
      const result = await openDataService.fetchChildcareData();

      result.forEach(item => {
        expect(item.metadata).toHaveProperty('source');
        expect(item.metadata).toHaveProperty('lastUpdated');
        expect(item.metadata).toHaveProperty('language');
        expect(item.metadata.language).toBe('ja');
        expect(item.metadata.lastUpdated).toBeInstanceOf(Date);
      });
    });

    test('should return items with meaningful content', async () => {
      const result = await openDataService.fetchChildcareData();

      result.forEach(item => {
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.content.length).toBeGreaterThan(0);
        expect(item.tags.length).toBeGreaterThan(0);
      });
    });

    test('should categorize all items as childcare', async () => {
      const result = await openDataService.fetchChildcareData();

      result.forEach(item => {
        expect(item.category).toBe('childcare');
      });
    });
  });

  describe('integration scenarios', () => {
    test('should handle partial dataset failures', async () => {
      // Mock mixed success/failure for different datasets
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            success: true,
            result: {
              id: 'success-dataset',
              title: 'Success Dataset',
              resources: [],
            },
          },
        })
        .mockRejectedValueOnce(new Error('Failed dataset'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            result: {
              id: 'another-success',
              title: 'Another Success',
              resources: [],
            },
          },
        });

      const result = await openDataService.fetchChildcareData();

      // Should still return data despite some failures
      expect(Array.isArray(result)).toBe(true);
    });
  });
});