// In-memory search cache with LRU eviction
import { SearchQuery, SearchResult, OpenDataItem } from '@/types';

interface CacheEntry {
  key: string;
  result: SearchResult;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export class SearchCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttl: number; // Time to live in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000, ttlMinutes: number = 15) {
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
    this.startCleanupProcess();
  }

  private generateCacheKey(query: SearchQuery): string {
    const normalized = {
      text: query.text.toLowerCase().trim(),
      category: query.category || '',
      language: query.language || 'ja',
      limit: query.limit || 10,
      filters: query.filters || {},
    };
    return JSON.stringify(normalized);
  }

  get(query: SearchQuery): SearchResult | null {
    const key = this.generateCacheKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access information for LRU
    entry.accessCount++;
    entry.lastAccessed = now;
    this.cache.set(key, entry);

    // Mark result as coming from cache
    return {
      ...entry.result,
      usedCache: true,
    };
  }

  set(query: SearchQuery, result: SearchResult): void {
    const key = this.generateCacheKey(query);
    const now = Date.now();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      key,
      result: {
        ...result,
        usedCache: false,
      },
      timestamp: now,
      accessCount: 0, // Start with 0, will be incremented on first access
      lastAccessed: now,
    };

    this.cache.set(key, entry);
  }

  private evictLRU(): void {
    if (this.cache.size === 0) return;
    
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanupProcess(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} expired entries`);
  }

  // Manual cache invalidation
  invalidate(pattern?: string): number {
    let removedCount = 0;

    if (!pattern) {
      // Clear all cache
      removedCount = this.cache.size;
      this.cache.clear();
    } else {
      // Remove entries matching pattern
      const keysToDelete: string[] = [];
      for (const [key] of this.cache.entries()) {
        if (key.includes(pattern.toLowerCase())) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
      removedCount = keysToDelete.length;
    }

    console.log(`🗑️ Cache invalidation: removed ${removedCount} entries`);
    return removedCount;
  }

  // Cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    averageAccessCount: number;
  } {
    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);
    
    const avgAccessCount = this.cache.size > 0 ? totalAccess / this.cache.size : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses to calculate this
      averageAccessCount: avgAccessCount,
    };
  }

  // Cleanup method for proper resource management
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    console.log('🧹 SearchCache cleanup completed');
  }
}

// Singleton instance
let searchCacheInstance: SearchCache | null = null;

export const getSearchCache = (): SearchCache => {
  if (!searchCacheInstance) {
    searchCacheInstance = new SearchCache();
  }
  return searchCacheInstance;
};