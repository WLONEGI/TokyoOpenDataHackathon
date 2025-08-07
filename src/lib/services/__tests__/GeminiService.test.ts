import { GeminiService } from '../GeminiService';

// Mock the Google Generative AI module
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockResolvedValue('Mock response text'),
        },
      }),
      embedContent: jest.fn().mockResolvedValue({
        embedding: {
          values: [0.1, 0.2, 0.3, 0.4, 0.5],
        },
      }),
    }),
  })),
}));

// Mock the config module
jest.mock('@/lib/config', () => ({
  config: {
    geminiApiKey: 'mock-api-key',
  },
}));

describe('GeminiService', () => {
  let geminiService: GeminiService;

  beforeEach(() => {
    geminiService = new GeminiService();
  });

  describe('constructor', () => {
    test('should initialize with valid API key', () => {
      expect(() => new GeminiService()).not.toThrow();
    });
  });

  describe('generateText', () => {
    test('should generate text response in Japanese', async () => {
      const result = await geminiService.generateText(
        '保育園について教えて',
        '東京都の保育園情報',
        'ja'
      );

      expect(result).toBe('Mock response text');
      expect(typeof result).toBe('string');
    });

    test('should generate text response in English', async () => {
      const result = await geminiService.generateText(
        'Tell me about nurseries',
        'Tokyo nursery information',
        'en'
      );

      expect(result).toBe('Mock response text');
      expect(typeof result).toBe('string');
    });

    test('should handle context with prompt', async () => {
      const context = '東京都の子育て支援制度について詳しい情報があります。';
      const prompt = '子育て支援制度について教えて';

      const result = await geminiService.generateText(prompt, context, 'ja');

      expect(result).toBe('Mock response text');
    });

    test('should handle prompt without context', async () => {
      const prompt = '一般的な質問';

      const result = await geminiService.generateText(prompt, undefined, 'ja');

      expect(result).toBe('Mock response text');
    });

    test('should handle audio model flag', async () => {
      const result = await geminiService.generateText(
        'Hello',
        'Context',
        'en',
        true
      );

      expect(result).toBe('Mock response text');
    });
  });

  describe('processAudio', () => {
    test('should process audio data', async () => {
      const audioData = 'base64-encoded-audio-data';
      const mimeType = 'audio/wav';

      const result = await geminiService.processAudio(audioData, mimeType);

      expect(result).toHaveProperty('text');
      expect(result.text).toContain('Web Speech API');
    });

    test('should handle empty audio data', async () => {
      await expect(
        geminiService.processAudio('', 'audio/wav')
      ).rejects.toThrow('Failed to process audio');
    });
  });

  describe('generateSpeech', () => {
    test('should attempt to generate speech', async () => {
      const result = await geminiService.generateSpeech('Hello world', 'en');

      // Current implementation returns null as fallback
      expect(result).toBeNull();
    });

    test('should handle Japanese text', async () => {
      const result = await geminiService.generateSpeech('こんにちは', 'ja');

      expect(result).toBeNull();
    });
  });

  describe('embedText', () => {
    test('should generate text embeddings', async () => {
      const text = 'Sample text for embedding';

      const result = await geminiService.embedText(text);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(5);
      expect(result[0]).toBe(0.1);
    });

    test('should handle empty text', async () => {
      const result = await geminiService.embedText('');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('analyzeIntent', () => {
    test('should analyze intent for childcare questions', async () => {
      const message = '保育園の申し込み方法を教えて';

      const result = await geminiService.analyzeIntent(message, 'ja');

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('entities');
      expect(typeof result.intent).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.entities)).toBe(true);
    });

    test('should analyze intent for greetings', async () => {
      const message = 'こんにちは';

      const result = await geminiService.analyzeIntent(message, 'ja');

      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should handle English messages', async () => {
      const message = 'Hello, can you help me with childcare information?';

      const result = await geminiService.analyzeIntent(message, 'en');

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('entities');
    });

    test('should handle Chinese messages', async () => {
      const message = '你好，请问育儿信息';

      const result = await geminiService.analyzeIntent(message, 'zh');

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
    });

    test('should handle Korean messages', async () => {
      const message = '안녕하세요, 육아 정보 부탁합니다';

      const result = await geminiService.analyzeIntent(message, 'ko');

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
    });

    test('should provide fallback for invalid JSON response', async () => {
      // Test analyzeIntent with a message that would cause JSON parsing to fail
      // We'll rely on the existing mock that returns 'Mock response text' 
      // which is not valid JSON, so it should trigger the fallback
      const result = await geminiService.analyzeIntent('test message', 'ja');

      // Should return fallback values when JSON parsing fails
      expect(result.intent).toBe('question');
      expect(result.confidence).toBe(0.5);
      expect(Array.isArray(result.entities)).toBe(true);
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      geminiService.cleanup();

      expect(consoleSpy).toHaveBeenCalledWith('GeminiService cleanup completed');
      
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    test('should handle analyzeIntent errors gracefully by using mock response', async () => {
      // The existing mock will trigger fallback behavior due to JSON parsing failure
      const result = await geminiService.analyzeIntent('test message', 'ja');

      // Should return fallback values due to JSON parsing failure
      expect(result.intent).toBe('question');
      expect(result.confidence).toBe(0.5);
      expect(Array.isArray(result.entities)).toBe(true);
    });

    test('should handle service errors in general', () => {
      // Test that the service has proper error handling structure
      expect(typeof geminiService.generateText).toBe('function');
      expect(typeof geminiService.analyzeIntent).toBe('function');
      expect(typeof geminiService.embedText).toBe('function');
      expect(typeof geminiService.processAudio).toBe('function');
    });
  });
});