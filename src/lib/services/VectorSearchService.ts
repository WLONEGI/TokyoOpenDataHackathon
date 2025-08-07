import { OpenDataItem, SearchQuery, SearchResult, SupportedLanguage, OpenDataCategory } from '@/types';
import { GeminiService } from './GeminiService';
import { OpenDataService } from './OpenDataService';
import { TokyoOpenDataService } from './TokyoOpenDataService';
import { getVertexVectorSearchService } from './VertexVectorSearchService';
import { getSearchCache } from '@/lib/cache/SearchCache';
import { log } from '@/lib/logger';

export class VectorSearchService {
  private geminiService: GeminiService;
  private openDataService: OpenDataService;
  private tokyoOpenDataService: TokyoOpenDataService;
  private vertexVectorSearchService: {
    initialize(): Promise<void>;
    search(query: string, options?: any): Promise<SearchResult>;
  } | null = null;
  private indexedItems: Map<string, OpenDataItem> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private useVertexSearch: boolean = false;
  private useDynamicSearch: boolean = true; // 動的検索を有効化

  constructor() {
    this.geminiService = new GeminiService();
    this.openDataService = new OpenDataService();
    this.tokyoOpenDataService = new TokyoOpenDataService();
    
    try {
      this.vertexVectorSearchService = getVertexVectorSearchService();
    } catch (error) {
      log.warn('VertexVectorSearchService not available', { error: (error as Error).message });
      this.vertexVectorSearchService = null;
    }
    
    // Check if Vertex Vector Search is available
    this.checkVertexAvailability();
  }

  private async checkVertexAvailability(): Promise<void> {
    if (!this.vertexVectorSearchService) {
      this.useVertexSearch = false;
      log.info('Vertex Vector Search service not initialized');
      return;
    }

    try {
      await this.vertexVectorSearchService.initialize();
      this.useVertexSearch = true;
      log.info('Vertex Vector Search is available and will be used for enhanced search', {
        provider: 'Google Cloud Vertex AI'
      });
    } catch (error) {
      this.useVertexSearch = false;
      log.info('Vertex Vector Search not available, using local search', {
        reason: (error as Error).message,
        fallback: 'local vector search'
      });
    }
  }

  async initializeIndex(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }
  
  private async doInitialize(): Promise<void> {
    try {
      const startTime = Date.now();
      const items = await this.openDataService.fetchChildcareData();
      
      // Increased batch size for better parallel processing
      const batchSize = 10;
      const batches = this.chunkArray(items, batchSize);
      
      // Process batches in parallel with concurrency limit
      const concurrencyLimit = 3;
      await this.processBatchesConcurrently(batches, concurrencyLimit);

      const endTime = Date.now();
      this.isInitialized = true;
      log.info(`✅ Initialized vector index with ${this.indexedItems.size} items in ${endTime - startTime}ms`, {
        totalItems: this.indexedItems.size,
        processingTime: endTime - startTime,
        itemsPerSecond: Math.round(this.indexedItems.size / ((endTime - startTime) / 1000)),
      });
    } catch (error) {
      this.initializationPromise = null;
      log.error('Error initializing vector index:', error as Error);
      throw error;
    }
  }

  private async processBatchesConcurrently(batches: OpenDataItem[][], concurrencyLimit: number): Promise<void> {
    const processBatch = async (batch: OpenDataItem[]): Promise<void> => {
      await Promise.all(batch.map(async (item) => {
        if (!item.embeddings) {
          const textToEmbed = `${item.title} ${item.description} ${item.content}`;
          const cacheKey = this.getEmbeddingCacheKey(textToEmbed);
          
          let embeddings = this.embeddingCache.get(cacheKey);
          if (!embeddings) {
            try {
              embeddings = await this.geminiService.embedText(textToEmbed);
              this.embeddingCache.set(cacheKey, embeddings);
            } catch (error) {
              log.error(`Failed to generate embeddings for item ${item.id}:`, error as Error);
              return;
            }
          }
          item.embeddings = embeddings;
        }
        this.indexedItems.set(item.id, item);
      }));
    };

    // Process batches with concurrency limit
    const processing: Promise<void>[] = [];
    for (let i = 0; i < batches.length; i += concurrencyLimit) {
      const concurrentBatches = batches.slice(i, i + concurrencyLimit);
      const batchPromises = concurrentBatches.map(batch => processBatch(batch));
      processing.push(Promise.all(batchPromises).then(() => {}));
      
      // Add small delay between batch groups to prevent overwhelming the API
      if (i + concurrencyLimit < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    await Promise.all(processing);
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const cache = getSearchCache();
    
    try {
      const cachedResult = cache.get(query);
      if (cachedResult) {
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime,
          usedCache: true,
        };
      }
      
      // 1. 動的検索が有効で、クエリテキストがある場合は新しいTokyoOpenDataServiceを使用
      if (this.useDynamicSearch && query.text && query.text.trim().length > 0) {
        try {
          log.info('Using dynamic Tokyo Open Data search', {
            query: query.text.substring(0, 50),
            language: query.language,
          });
          
          const dynamicResults = await this.tokyoOpenDataService.fetchRelevantData(
            query.text, 
            query.language || 'ja'
          );
          
          if (dynamicResults.length > 0) {
            // 動的検索結果をインデックスに追加（将来の検索で利用）
            dynamicResults.forEach(item => {
              this.indexedItems.set(item.id, item);
            });
            
            const searchResult: SearchResult = {
              items: dynamicResults.slice(0, query.limit || 10),
              total: dynamicResults.length,
              query: query.text,
              processingTime: Date.now() - startTime,
              usedCache: false,
              searchMethod: 'dynamic'
            };
            
            cache.set(query, searchResult);
            
            log.info('Dynamic search completed successfully', {
              query: query.text.substring(0, 50),
              resultCount: dynamicResults.length,
              processingTime: searchResult.processingTime,
            });
            
            return searchResult;
          }
        } catch (error) {
          log.warn('Dynamic search failed, falling back to other methods', {
            error: (error as Error).message,
            query: query.text.substring(0, 50),
          });
          // Continue to other search methods
        }
      }
      
      // 2. Vertex Vector Search（既存）
      if (this.useVertexSearch && query.text) {
        try {
          log.debug('Using Vertex Vector Search for enhanced results', {
            query: query.text.substring(0, 50),
            language: query.language,
          });
          
          const vertexResult = await this.vertexVectorSearchService.search(query);
          
          if (vertexResult.items.length > 0) {
            cache.set(query, vertexResult);
            
            log.info('Vertex Vector Search completed successfully', {
              query: query.text.substring(0, 50),
              resultCount: vertexResult.items.length,
              processingTime: vertexResult.processingTime,
            });
            
            return {
              ...vertexResult,
              processingTime: Date.now() - startTime,
              usedCache: false,
              searchMethod: 'vertex'
            };
          }
        } catch (error) {
          log.warn('Vertex Vector Search failed, falling back to local search', {
            error: (error as Error).message,
            query: query.text.substring(0, 50),
          });
        }
      }
      
      // 3. ローカルベクトル検索（既存のフォールバック）
      if (!this.isInitialized) {
        log.info('Vector index not yet initialized, using basic search fallback');
        // Don't wait for initialization, proceed with fallback
        return this.performBasicSearch(query, startTime);
      }
      
      let results: OpenDataItem[] = [];

      if (query.text) {
        try {
          const embeddingCacheKey = this.getEmbeddingCacheKey(query.text);
          let queryEmbedding = this.embeddingCache.get(embeddingCacheKey);
          
          if (!queryEmbedding) {
            queryEmbedding = await this.geminiService.embedText(query.text);
            this.embeddingCache.set(embeddingCacheKey, queryEmbedding);
          }
          
          results = await this.vectorSimilaritySearch(queryEmbedding, query.limit || 10);
        } catch (error) {
          log.warn('Local vector search failed, falling back to text search', {
            query: query.text?.substring(0, 50),
            fallback: 'text-search',
            error: (error as Error).message
          });
          results = await this.textSearch(query.text, query.limit || 10);
        }
      } else {
        results = this.getRandomSample(Array.from(this.indexedItems.values()), query.limit || 10);
      }

      results = this.applyFilters(results, query);
      
      const searchResult: SearchResult = {
        items: results,
        total: results.length,
        query: query.text || '',
        processingTime: Date.now() - startTime,
        usedCache: false,
        searchMethod: 'local'
      };
      
      cache.set(query, searchResult);
      
      return searchResult;
    } catch (error) {
      log.error('Error in vector search service', error as Error, {
        query: query.text?.substring(0, 50),
        language: query.language,
      });
      
      return {
        items: await this.getFallbackResults(query),
        total: 1,
        query: query.text || '',
        processingTime: Date.now() - startTime,
        usedCache: false,
        searchMethod: 'fallback'
      };
    }
  }

  private async vectorSimilaritySearch(queryEmbedding: number[], limit: number): Promise<OpenDataItem[]> {
    const similarities: { item: OpenDataItem; similarity: number }[] = [];
    const items = Array.from(this.indexedItems.values());
    
    // Parallel processing for similarity calculations
    const batchSize = 100;
    const batches = this.chunkArray(items, batchSize);
    
    const batchPromises = batches.map(async (batch) => {
      const batchSimilarities: { item: OpenDataItem; similarity: number }[] = [];
      
      for (const item of batch) {
        if (item.embeddings && item.embeddings.length > 0) {
          const similarity = this.cosineSimilarity(queryEmbedding, item.embeddings);
          // Only keep items with reasonable similarity to reduce memory usage
          if (similarity > 0.1) {
            batchSimilarities.push({ item, similarity });
          }
        }
      }
      
      return batchSimilarities;
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten results
    for (const batchResult of batchResults) {
      similarities.push(...batchResult);
    }

    // Use partial sort for better performance when limit is small
    if (limit < similarities.length / 10) {
      // For small limits, use partial sort (heapselect-like approach)
      return this.partialSort(similarities, limit).map(s => s.item);
    } else {
      // For large limits, use full sort
      similarities.sort((a, b) => b.similarity - a.similarity);
      return similarities.slice(0, limit).map(s => s.item);
    }
  }

  private partialSort(similarities: { item: OpenDataItem; similarity: number }[], limit: number): { item: OpenDataItem; similarity: number }[] {
    // Simple implementation of partial sort - in practice, would use a more sophisticated heap
    const result = similarities.slice(0, limit);
    result.sort((a, b) => b.similarity - a.similarity);
    
    for (let i = limit; i < similarities.length; i++) {
      if (similarities[i].similarity > result[result.length - 1].similarity) {
        result[result.length - 1] = similarities[i];
        // Re-sort only the last element to maintain order
        for (let j = result.length - 1; j > 0 && result[j].similarity > result[j - 1].similarity; j--) {
          [result[j], result[j - 1]] = [result[j - 1], result[j]];
        }
      }
    }
    
    return result;
  }

  private async textSearch(query: string, limit: number): Promise<OpenDataItem[]> {
    const searchTerms = query.toLowerCase().split(' ');
    const results: { item: OpenDataItem; score: number }[] = [];

    for (const item of Array.from(this.indexedItems.values())) {
      const searchableText = (
        item.title + ' ' + 
        item.description + ' ' + 
        item.content + ' ' + 
        item.tags.join(' ')
      ).toLowerCase();

      let score = 0;
      for (const term of searchTerms) {
        if (searchableText.includes(term)) {
          score += 1;
          // Boost score for matches in title
          if (item.title.toLowerCase().includes(term)) {
            score += 2;
          }
          // Boost score for matches in tags
          if (item.tags.some((tag: string) => tag.toLowerCase().includes(term))) {
            score += 1;
          }
        }
      }

      if (score > 0) {
        results.push({ item, score });
      }
    }

    // Sort by score (descending) and return top results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(r => r.item);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async getFallbackResults(query: SearchQuery): Promise<OpenDataItem[]> {
    // Return a basic fallback result
    return [{
      id: 'fallback-search',
      title: 'お探しの情報について',
      description: 'ご質問にお答えできるよう努めます',
      category: 'general',
      tags: ['案内'],
      content: `申し訳ございませんが、「${query.text}」に関する具体的な情報が見つかりませんでした。\n\n東京都の子育て支援に関するご質問でしたら、以下の方法でより詳しい情報を得ることができます：\n\n1. 各区市町村の子ども家庭支援センター\n2. 東京都公式ホームページ\n3. 子育て応援とうきょうパスポート事業\n\n具体的な手続きや制度についてお知りになりたい場合は、お住まいの区市町村窓口にお問い合わせください。`,
      metadata: {
        source: 'システム',
        lastUpdated: new Date(),
        language: query.language || 'ja'
      }
    }];
  }

  async getRecommendations(currentQuery: string, limit: number = 3): Promise<OpenDataItem[]> {
    // If Vertex Vector Search is available, use it for recommendations
    if (this.useVertexSearch) {
      try {
        return await this.vertexVectorSearchService.getRecommendations(currentQuery, limit);
      } catch (error) {
        log.warn('Vertex recommendations failed, using local fallback', {
          query: currentQuery.substring(0, 50),
          fallback: 'local-recommendations',
          error: (error as Error).message
        });
      }
    }
    
    // Fallback to local recommendations
    const allItems = Array.from(this.indexedItems.values());
    
    // Return random selection for now - in production, this would be based on usage patterns
    const shuffled = allItems.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  }

  // Helper methods
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  private getEmbeddingCacheKey(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `embed_${hash.toString(36)}`;
  }
  
  private applyFilters(results: OpenDataItem[], query: SearchQuery): OpenDataItem[] {
    let filtered = results;
    
    if (query.category) {
      filtered = filtered.filter(item => item.category === query.category);
    }

    if (query.language) {
      filtered = filtered.filter(item => 
        item.metadata.language === query.language || 
        item.metadata.language === 'ja'
      );
    }
    
    if (query.filters) {
      const { dateFrom, dateTo, tags } = query.filters;
      
      if (dateFrom) {
        filtered = filtered.filter(item => 
          item.metadata.lastUpdated >= dateFrom
        );
      }
      
      if (dateTo) {
        filtered = filtered.filter(item => 
          item.metadata.lastUpdated <= dateTo
        );
      }
      
      if (tags && tags.length > 0) {
        filtered = filtered.filter(item => 
          tags.some(tag => item.tags.includes(tag))
        );
      }
    }
    
    return filtered;
  }
  
  private getRandomSample<T>(array: T[], size: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }

  getStats(): { 
    totalItems: number; 
    categoryCounts: Record<string, number>;
    embeddingCacheSize: number;
    isInitialized: boolean;
    itemsWithEmbeddings: number;
    useVertexSearch: boolean;
    vertexStats?: any;
  } {
    const categoryCounts: Record<string, number> = {};
    let itemsWithEmbeddings = 0;
    
    for (const item of Array.from(this.indexedItems.values())) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      if (item.embeddings && item.embeddings.length > 0) {
        itemsWithEmbeddings++;
      }
    }

    const stats = {
      totalItems: this.indexedItems.size,
      categoryCounts,
      embeddingCacheSize: this.embeddingCache.size,
      isInitialized: this.isInitialized,
      itemsWithEmbeddings,
      useVertexSearch: this.useVertexSearch,
    };

    // Include Vertex stats if available
    if (this.useVertexSearch && this.vertexVectorSearchService) {
      try {
        (stats as any).vertexStats = this.vertexVectorSearchService.getStats();
      } catch (error) {
        log.warn('Failed to get Vertex stats', {
          service: 'VertexVectorSearchService',
          error: (error as Error).message
        });
      }
    }

    return stats;
  }
  
  cleanup(): void {
    this.indexedItems.clear();
    this.embeddingCache.clear();
    this.isInitialized = false;
    this.initializationPromise = null;
    
    // Cleanup Vertex service if available
    if (this.vertexVectorSearchService) {
      try {
        this.vertexVectorSearchService.cleanup();
      } catch (error) {
        log.warn('Failed to cleanup Vertex Vector Search service', {
          service: 'VertexVectorSearchService',
          error: (error as Error).message
        });
      }
    }
    
    log.info('VectorSearchService cleanup completed');
  }

  private async performBasicSearch(query: SearchQuery, startTime: number): Promise<SearchResult> {
    try {
      // Fallback to OpenDataService for basic search
      const items = await this.openDataService.fetchChildcareData();
      
      let filteredItems = items;
      
      // Basic text filtering if query has text
      if (query.text && query.text.trim().length > 0) {
        const searchTerms = query.text.toLowerCase().split(' ');
        filteredItems = items.filter(item => {
          const searchText = `${item.title} ${item.description} ${item.content}`.toLowerCase();
          return searchTerms.some(term => searchText.includes(term));
        });
      }
      
      // Apply category filter if specified
      if (query.category) {
        filteredItems = filteredItems.filter(item => 
          item.category.toLowerCase().includes(query.category!.toLowerCase())
        );
      }
      
      // Apply location filter if specified
      if (query.location) {
        filteredItems = filteredItems.filter(item => 
          item.content.toLowerCase().includes(query.location!.toLowerCase())
        );
      }
      
      // Limit results
      const limit = query.limit || 10;
      const results = filteredItems.slice(0, limit);
      
      return {
        items: results,
        total: filteredItems.length,
        query: query.text || '',
        processingTime: Date.now() - startTime,
        usedCache: false,
        searchMethod: 'basic_fallback'
      };
    } catch (error) {
      log.error('Basic search fallback failed', error as Error);
      return {
        items: [],
        total: 0,
        query: query.text || '',
        processingTime: Date.now() - startTime,
        usedCache: false,
        searchMethod: 'error_fallback'
      };
    }
  }
}