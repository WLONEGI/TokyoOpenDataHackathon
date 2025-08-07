import { AutonomousSearchAgent } from '../AutonomousSearchAgent';
import { GeminiService } from '../GeminiService';
import { OpenDataService } from '../OpenDataService';
import { OpenDataItem } from '@/types';

jest.mock('../GeminiService');
jest.mock('../OpenDataService');
jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AutonomousSearchAgent', () => {
  let agent: AutonomousSearchAgent;
  let mockGeminiService: jest.Mocked<GeminiService>;
  let mockOpenDataService: jest.Mocked<OpenDataService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGeminiService = new GeminiService() as jest.Mocked<GeminiService>;
    mockOpenDataService = new OpenDataService() as jest.Mocked<OpenDataService>;

    agent = new AutonomousSearchAgent(mockGeminiService, mockOpenDataService);
  });

  describe('executeAdvancedSearch', () => {
    const mockQuery = '東京の公園情報';
    const mockSessionId = 'test-session-123';

    const mockSearchResults: OpenDataItem[] = [
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
        relevanceScore: 0.95,
      },
      {
        id: '2',
        title: '区立公園施設情報',
        description: '東京23区の区立公園情報',
        category: '公園・緑地',
        tags: ['公園', '区立', '施設'],
        source: 'tokyo-open-data',
        lastUpdated: new Date().toISOString(),
        dataUrl: 'https://example.com/ward-parks',
        format: 'json',
        content: '各区の公園施設詳細',
        relevanceScore: 0.85,
      },
    ];

    it('should execute advanced search successfully', async () => {
      // Mock intent analysis
      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        primaryIntent: '公園情報の検索',
        entities: ['東京', '公園'],
        searchType: 'location_based',
        requiredDataTypes: ['parks', 'facilities'],
        userGoal: '東京の公園を探している',
      }));

      // Mock strategy formulation
      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        keywordSets: [
          { primary: '東京 公園', variations: ['都立公園', '区立公園'] },
          { primary: '公園 施設', variations: ['公園情報', 'パーク'] },
        ],
        searchPhases: [
          { name: 'initial', keywords: ['東京 公園'], expectedResults: 10 },
          { name: 'expansion', keywords: ['都立公園', '区立公園'], expectedResults: 20 },
        ],
        evaluationCriteria: ['location_match', 'facility_info', 'accessibility'],
      }));

      // Mock search results
      mockOpenDataService.searchDatasets.mockResolvedValue(mockSearchResults);

      // Mock evaluation
      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        overallQuality: 0.9,
        relevantItems: ['1', '2'],
        missingInformation: ['開園時間', 'アクセス情報'],
        recommendations: ['時間情報を含むデータセットを追加で検索'],
      }));

      const result = await agent.executeAdvancedSearch(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(2);
      expect(result.metadata.totalFound).toBe(2);
      expect(result.metadata.searchStrategy).toBe('autonomous');
      expect(mockOpenDataService.searchDatasets).toHaveBeenCalled();
      expect(mockGeminiService.chat).toHaveBeenCalledTimes(3);
    });

    it('should handle search with no results', async () => {
      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        primaryIntent: '存在しないデータ',
        entities: ['テスト'],
        searchType: 'general',
        requiredDataTypes: ['test'],
        userGoal: 'テストデータを探している',
      }));

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        keywordSets: [{ primary: 'テスト', variations: [] }],
        searchPhases: [{ name: 'initial', keywords: ['テスト'], expectedResults: 0 }],
        evaluationCriteria: [],
      }));

      mockOpenDataService.searchDatasets.mockResolvedValue([]);

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        overallQuality: 0,
        relevantItems: [],
        missingInformation: ['すべて'],
        recommendations: ['別のキーワードで再検索'],
      }));

      const result = await agent.executeAdvancedSearch('存在しないデータ', mockSessionId);

      expect(result.items).toHaveLength(0);
      expect(result.metadata.totalFound).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockGeminiService.chat.mockRejectedValue(new Error('AI service error'));

      const result = await agent.executeAdvancedSearch(mockQuery, mockSessionId);

      expect(result.items).toHaveLength(0);
      expect(result.metadata.error).toBe('Search failed');
    });

    it('should expand search concepts', async () => {
      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        primaryIntent: '交通情報',
        entities: ['電車', '遅延'],
        searchType: 'transit',
        requiredDataTypes: ['transit', 'delays'],
        userGoal: '電車の遅延情報',
      }));

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        keywordSets: [
          { primary: '電車 遅延', variations: ['列車遅延', '運行情報', '鉄道'] },
        ],
        searchPhases: [
          { name: 'initial', keywords: ['電車 遅延'], expectedResults: 5 },
        ],
        evaluationCriteria: ['realtime', 'accuracy'],
      }));

      mockOpenDataService.searchDatasets.mockResolvedValue([]);

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        overallQuality: 0.3,
        relevantItems: [],
        missingInformation: ['リアルタイム情報'],
        recommendations: ['運行情報で再検索'],
      }));

      await agent.executeAdvancedSearch('電車の遅延', mockSessionId);

      const searchCalls = mockOpenDataService.searchDatasets.mock.calls;
      expect(searchCalls.length).toBeGreaterThan(1);
    });
  });

  describe('private methods', () => {
    it('should remove duplicates correctly', async () => {
      const items: OpenDataItem[] = [
        {
          id: '1',
          title: 'データ1',
          description: '説明1',
          category: 'カテゴリ',
          tags: [],
          source: 'source',
          lastUpdated: new Date().toISOString(),
          dataUrl: 'url1',
          format: 'json',
        },
        {
          id: '1', // 重複ID
          title: 'データ1',
          description: '説明1',
          category: 'カテゴリ',
          tags: [],
          source: 'source',
          lastUpdated: new Date().toISOString(),
          dataUrl: 'url1',
          format: 'json',
        },
        {
          id: '2',
          title: 'データ2',
          description: '説明2',
          category: 'カテゴリ',
          tags: [],
          source: 'source',
          lastUpdated: new Date().toISOString(),
          dataUrl: 'url2',
          format: 'json',
        },
      ];

      // removeDuplicatesメソッドをテストするため、実際の検索を実行
      mockGeminiService.chat.mockResolvedValue(JSON.stringify({
        primaryIntent: 'test',
        entities: ['test'],
        searchType: 'general',
        requiredDataTypes: ['test'],
        userGoal: 'test',
      }));

      mockGeminiService.chat.mockResolvedValue(JSON.stringify({
        keywordSets: [{ primary: 'test', variations: [] }],
        searchPhases: [{ name: 'initial', keywords: ['test'], expectedResults: 3 }],
        evaluationCriteria: [],
      }));

      mockOpenDataService.searchDatasets.mockResolvedValue(items);

      mockGeminiService.chat.mockResolvedValue(JSON.stringify({
        overallQuality: 0.5,
        relevantItems: ['1', '2'],
        missingInformation: [],
        recommendations: [],
      }));

      const result = await agent.executeAdvancedSearch('test', 'session-123');

      // 重複が除去されていることを確認
      expect(result.items).toHaveLength(2);
      expect(result.items.map(item => item.id)).toEqual(['1', '2']);
    });
  });
});