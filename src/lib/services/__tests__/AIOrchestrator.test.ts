import { AIOrchestrator } from '../AIOrchestrator';
import { GeminiService } from '../GeminiService';
import { AutonomousSearchAgent } from '../AutonomousSearchAgent';
import { VectorSearchService } from '../VectorSearchService';
import { TimeContextService } from '../TimeContextService';
import { GeospatialContextService } from '../GeospatialContextService';
import { OpenDataItem } from '@/types';

jest.mock('../GeminiService');
jest.mock('../AutonomousSearchAgent');
jest.mock('../VectorSearchService');
jest.mock('../TimeContextService');
jest.mock('../GeospatialContextService');
jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AIOrchestrator', () => {
  let orchestrator: AIOrchestrator;
  let mockGeminiService: jest.Mocked<GeminiService>;
  let mockSearchAgent: jest.Mocked<AutonomousSearchAgent>;
  let mockVectorService: jest.Mocked<VectorSearchService>;
  let mockTimeService: jest.Mocked<TimeContextService>;
  let mockGeoService: jest.Mocked<GeospatialContextService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGeminiService = new GeminiService() as jest.Mocked<GeminiService>;
    mockSearchAgent = new AutonomousSearchAgent(
      mockGeminiService,
      {} as any
    ) as jest.Mocked<AutonomousSearchAgent>;
    mockVectorService = new VectorSearchService(
      {} as any,
      {} as any
    ) as jest.Mocked<VectorSearchService>;
    mockTimeService = new TimeContextService() as jest.Mocked<TimeContextService>;
    mockGeoService = new GeospatialContextService() as jest.Mocked<GeospatialContextService>;

    orchestrator = new AIOrchestrator(
      mockGeminiService,
      mockSearchAgent,
      mockVectorService,
      mockTimeService,
      mockGeoService
    );
  });

  describe('processUserInput', () => {
    const mockUserInput = {
      sessionId: 'test-session-123',
      message: '明日の天気を教えて',
      language: 'ja' as const,
      inputType: 'text' as const,
    };

    const mockSearchResults: OpenDataItem[] = [
      {
        id: '1',
        title: '東京都天気予報データ',
        description: '明日の天気予報',
        category: '気象',
        tags: ['天気', '予報'],
        source: 'tokyo-open-data',
        lastUpdated: new Date().toISOString(),
        dataUrl: 'https://example.com/weather',
        format: 'json',
        content: '明日は晴れ',
        relevanceScore: 0.9,
      },
    ];

    it('should process user input successfully', async () => {
      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        primaryGoal: '天気情報の取得',
        context: '明日の天気',
        userType: 'citizen',
        urgency: 'low',
        complexity: 'simple',
        specificNeeds: ['天気予報'],
        implicitRequirements: ['地域の天気'],
        requiredCapabilities: ['weather_search'],
        estimatedSteps: 2,
      }));

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        hasData: true,
        canSearch: true,
        canAnalyze: true,
        canVisualize: false,
        requiredDataTypes: ['weather'],
      }));

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        phases: [
          {
            name: 'search',
            action: 'searchWeatherData',
            parameters: { query: '明日の天気' },
            expectedOutcome: '天気データの取得',
          },
        ],
      }));

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        steps: [
          {
            stepNumber: 1,
            description: '天気情報を検索',
            reasoning: 'ユーザーが明日の天気を知りたい',
            action: 'search',
            confidence: 0.9,
            evidence: [],
            nextActions: ['respond'],
          },
        ],
      }));

      mockGeminiService.chat.mockResolvedValueOnce(JSON.stringify({
        sources: ['天気予報データ'],
        derivedInsights: ['明日は晴れ'],
        confidence: 0.9,
      }));

      mockSearchAgent.executeAdvancedSearch.mockResolvedValue({
        items: mockSearchResults,
        metadata: {
          totalFound: 1,
          searchStrategy: 'weather',
          processingTime: 100,
        },
      });

      mockGeminiService.generateResponse.mockResolvedValue(
        '明日の東京の天気は晴れの予報です。'
      );

      const result = await orchestrator.processUserInput(mockUserInput);

      expect(result.sessionId).toBe(mockUserInput.sessionId);
      expect(result.response).toBe('明日の東京の天気は晴れの予報です。');
      expect(result.dataUsed).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockSearchAgent.executeAdvancedSearch).toHaveBeenCalled();
      expect(mockGeminiService.generateResponse).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockGeminiService.chat.mockRejectedValue(new Error('AI service error'));

      const result = await orchestrator.processUserInput(mockUserInput);

      expect(result.response).toContain('申し訳ございません');
      expect(result.error).toBe('Failed to process request');
      expect(result.confidence).toBe(0);
    });

    it('should use temporal context when provided', async () => {
      const inputWithTime = {
        ...mockUserInput,
        timestamp: new Date(),
        requestedScope: {
          timeRange: 'tomorrow' as any,
        },
      };

      mockTimeService.analyzeTemporalContext.mockResolvedValue({
        currentTime: new Date(),
        timeOfDay: 'afternoon',
        dayOfWeek: 'monday',
        isWeekend: false,
        isHoliday: false,
        season: 'summer',
        relativeTime: {
          isPast: false,
          isFuture: true,
          isToday: false,
          distance: '1 day',
        },
      });

      mockGeminiService.chat.mockResolvedValue(JSON.stringify({
        primaryGoal: '天気情報の取得',
        context: '明日の天気',
        userType: 'citizen',
        urgency: 'low',
        complexity: 'simple',
        specificNeeds: ['天気予報'],
        implicitRequirements: [],
        requiredCapabilities: ['weather_search'],
        estimatedSteps: 1,
      }));

      await orchestrator.processUserInput(inputWithTime);

      expect(mockTimeService.analyzeTemporalContext).toHaveBeenCalled();
    });

    it('should use geospatial context when location is provided', async () => {
      const inputWithLocation = {
        ...mockUserInput,
        location: { latitude: 35.6762, longitude: 139.6503 },
      };

      mockGeoService.analyzeGeospatialContext.mockResolvedValue({
        coordinates: { latitude: 35.6762, longitude: 139.6503 },
        address: '東京都千代田区',
        district: '千代田区',
        city: '東京都',
        nearbyLandmarks: [],
        isUrbanArea: true,
        populationDensity: 'high',
      });

      mockGeminiService.chat.mockResolvedValue(JSON.stringify({
        primaryGoal: '天気情報の取得',
        context: '明日の天気',
        userType: 'citizen',
        urgency: 'low',
        complexity: 'simple',
        specificNeeds: ['天気予報'],
        implicitRequirements: [],
        requiredCapabilities: ['weather_search'],
        estimatedSteps: 1,
      }));

      await orchestrator.processUserInput(inputWithLocation);

      expect(mockGeoService.analyzeGeospatialContext).toHaveBeenCalled();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const metrics = orchestrator.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('confidenceScore');
      expect(metrics).toHaveProperty('dataUtilization');
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', async () => {
      await orchestrator.clearCache();

      expect(mockVectorService.clearCache).toHaveBeenCalled();
    });
  });
});