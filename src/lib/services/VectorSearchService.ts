import { OpenDataItem, SearchQuery, SearchResult } from '@/types';
import { GeminiService } from './GeminiService';
import { OpenDataService } from './OpenDataService';

export class VectorSearchService {
  private geminiService: GeminiService;
  private openDataService: OpenDataService;
  private indexedItems: Map<string, OpenDataItem> = new Map();

  constructor() {
    this.geminiService = new GeminiService();
    this.openDataService = new OpenDataService();
  }

  async initializeIndex(): Promise<void> {
    try {
      const items = await this.openDataService.fetchChildcareData();
      
      for (const item of items) {
        if (!item.embeddings) {
          // Generate embeddings for content
          const textToEmbed = `${item.title} ${item.description} ${item.content}`;
          try {
            item.embeddings = await this.geminiService.embedText(textToEmbed);
          } catch (error) {
            console.error(`Failed to generate embeddings for item ${item.id}:`, error);
            // Continue without embeddings
          }
        }
        this.indexedItems.set(item.id, item);
      }

      console.log(`Initialized vector index with ${this.indexedItems.size} items`);
    } catch (error) {
      console.error('Error initializing vector index:', error);
      throw error;
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    try {
      let results: OpenDataItem[] = [];

      // If we have embeddings, use vector similarity search
      if (query.text) {
        try {
          const queryEmbedding = await this.geminiService.embedText(query.text);
          results = await this.vectorSimilaritySearch(queryEmbedding, query.limit || 10);
        } catch (error) {
          console.error('Vector search failed, falling back to text search:', error);
          results = await this.textSearch(query.text, query.limit || 10);
        }
      } else {
        // Fallback to getting all items
        results = Array.from(this.indexedItems.values()).slice(0, query.limit || 10);
      }

      // Filter by category if specified
      if (query.category) {
        results = results.filter(item => item.category === query.category);
      }

      // Filter by language if specified
      if (query.language) {
        results = results.filter(item => 
          item.metadata.language === query.language || 
          item.metadata.language === 'ja' // Default to Japanese if no specific language
        );
      }

      return {
        items: results,
        total: results.length,
        query: query.text || ''
      };
    } catch (error) {
      console.error('Error in vector search:', error);
      // Return fallback results
      return {
        items: await this.getFallbackResults(query),
        total: 1,
        query: query.text || ''
      };
    }
  }

  private async vectorSimilaritySearch(queryEmbedding: number[], limit: number): Promise<OpenDataItem[]> {
    const similarities: { item: OpenDataItem; similarity: number }[] = [];

    for (const item of Array.from(this.indexedItems.values())) {
      if (item.embeddings && item.embeddings.length > 0) {
        const similarity = this.cosineSimilarity(queryEmbedding, item.embeddings);
        similarities.push({ item, similarity });
      }
    }

    // Sort by similarity (descending) and return top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, limit).map(s => s.item);
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
    // Simple recommendation based on popular/featured content
    const allItems = Array.from(this.indexedItems.values());
    
    // Return random selection for now - in production, this would be based on usage patterns
    const shuffled = allItems.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  }

  getStats(): { totalItems: number; categoryCounts: Record<string, number> } {
    const categoryCounts: Record<string, number> = {};
    
    for (const item of Array.from(this.indexedItems.values())) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }

    return {
      totalItems: this.indexedItems.size,
      categoryCounts
    };
  }
}