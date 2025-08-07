import { SearchCache } from '../SearchCache';
import { SearchQuery, SearchResult } from '@/types';

describe('SearchCache', () => {
  let cache: SearchCache;

  beforeEach(() => {
    cache = new SearchCache(100, 5); // 100 entries, 5 minutes TTL
  });

  afterEach(() => {
    cache.cleanup();
  });

  const createTestQuery = (text: string = 'test query'): SearchQuery => ({
    text,
    language: 'ja',
    limit: 10,
  });

  const createTestResult = (query: string = 'test query'): SearchResult => ({
    items: [],
    total: 0,
    query,
    processingTime: 100,
    usedCache: false,
  });

  describe('Cache Operations', () => {
    test('should store and retrieve cache entries', () => {
      const query = createTestQuery('hello world');
      const result = createTestResult('hello world');

      // Should return null for non-existent entry
      expect(cache.get(query)).toBeNull();

      // Store entry
      cache.set(query, result);

      // Should retrieve stored entry
      const cachedResult = cache.get(query);
      expect(cachedResult).not.toBeNull();
      expect(cachedResult?.query).toBe('hello world');
      expect(cachedResult?.usedCache).toBe(true);
    });

    test('should handle cache key normalization', () => {
      const query1 = createTestQuery('  HELLO WORLD  ');
      const query2 = createTestQuery('hello world');
      const result = createTestResult('hello world');

      cache.set(query1, result);

      // Should find entry with normalized key
      const cachedResult = cache.get(query2);
      expect(cachedResult).not.toBeNull();
      expect(cachedResult?.usedCache).toBe(true);
    });

    test('should respect different query parameters', () => {
      const query1 = createTestQuery('test');
      const query2 = { ...createTestQuery('test'), language: 'en' as const };
      const result1 = createTestResult('test ja');
      const result2 = createTestResult('test en');

      cache.set(query1, result1);
      cache.set(query2, result2);

      expect(cache.get(query1)?.query).toBe('test ja');
      expect(cache.get(query2)?.query).toBe('test en');
    });
  });

  describe('TTL (Time To Live)', () => {
    test('should expire entries after TTL', (done) => {
      const shortTTLCache = new SearchCache(100, 0.01); // 0.01 minutes = 0.6 seconds
      const query = createTestQuery();
      const result = createTestResult();

      shortTTLCache.set(query, result);
      expect(shortTTLCache.get(query)).not.toBeNull();

      // Wait for expiration
      setTimeout(() => {
        expect(shortTTLCache.get(query)).toBeNull();
        shortTTLCache.cleanup();
        done();
      }, 700); // Wait slightly longer than TTL
    });

    test('should update access time on get', () => {
      const query = createTestQuery();
      const result = createTestResult();

      cache.set(query, result);
      
      // Access the entry multiple times
      cache.get(query);
      cache.get(query);
      cache.get(query);

      // Entry should still be accessible
      expect(cache.get(query)).not.toBeNull();
    });
  });

  describe('LRU Eviction', () => {
    test('should evict least recently used entries when cache is full', async () => {
      const smallCache = new SearchCache(3, 60); // Only 3 entries
      
      const query1 = createTestQuery('query1');
      const query2 = createTestQuery('query2');
      const query3 = createTestQuery('query3');
      const query4 = createTestQuery('query4');

      // Fill cache with some time spacing
      smallCache.set(query1, createTestResult('result1'));
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay
      smallCache.set(query2, createTestResult('result2'));
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay
      smallCache.set(query3, createTestResult('result3'));

      // All entries should be present
      expect(smallCache.get(query1)).not.toBeNull();
      expect(smallCache.get(query2)).not.toBeNull();
      expect(smallCache.get(query3)).not.toBeNull();

      // Access query1 and query3 to make them recently used, leaving query2 as LRU
      await new Promise(resolve => setTimeout(resolve, 5));
      smallCache.get(query1);
      await new Promise(resolve => setTimeout(resolve, 5));
      smallCache.get(query3);

      // Add fourth entry (should evict query2 as it's least recently used)
      await new Promise(resolve => setTimeout(resolve, 5));
      smallCache.set(query4, createTestResult('result4'));

      expect(smallCache.get(query1)).not.toBeNull(); // Recently accessed
      expect(smallCache.get(query2)).toBeNull(); // Should be evicted
      expect(smallCache.get(query3)).not.toBeNull(); // Recently accessed
      expect(smallCache.get(query4)).not.toBeNull(); // Newly added

      smallCache.cleanup();
    });
  });

  describe('Cache Invalidation', () => {
    test('should clear all cache when no pattern provided', () => {
      const query1 = createTestQuery('query1');
      const query2 = createTestQuery('query2');

      cache.set(query1, createTestResult('result1'));
      cache.set(query2, createTestResult('result2'));

      expect(cache.get(query1)).not.toBeNull();
      expect(cache.get(query2)).not.toBeNull();

      const removedCount = cache.invalidate();
      expect(removedCount).toBe(2);
      expect(cache.get(query1)).toBeNull();
      expect(cache.get(query2)).toBeNull();
    });

    test('should clear cache entries matching pattern', () => {
      const query1 = createTestQuery('hello world');
      const query2 = createTestQuery('hello universe');
      const query3 = createTestQuery('goodbye world');

      cache.set(query1, createTestResult());
      cache.set(query2, createTestResult());
      cache.set(query3, createTestResult());

      // Invalidate entries containing 'hello'
      const removedCount = cache.invalidate('hello');
      expect(removedCount).toBe(2);

      expect(cache.get(query1)).toBeNull();
      expect(cache.get(query2)).toBeNull();
      expect(cache.get(query3)).not.toBeNull(); // Should remain
    });
  });

  describe('Cache Statistics', () => {
    test('should provide accurate statistics', () => {
      const query1 = createTestQuery('query1');
      const query2 = createTestQuery('query2');

      // Initially empty
      let stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(100);

      // Add entries
      cache.set(query1, createTestResult());
      cache.set(query2, createTestResult());

      stats = cache.getStats();
      expect(stats.size).toBe(2);

      // Access entries to change access count
      cache.get(query1);
      cache.get(query1);
      cache.get(query2);

      stats = cache.getStats();
      expect(stats.averageAccessCount).toBeGreaterThan(1);
    });
  });

  describe('Cleanup', () => {
    test('should clear all data on cleanup', () => {
      const query = createTestQuery();
      cache.set(query, createTestResult());

      expect(cache.get(query)).not.toBeNull();
      expect(cache.getStats().size).toBe(1);

      cache.cleanup();

      expect(cache.get(query)).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });
});