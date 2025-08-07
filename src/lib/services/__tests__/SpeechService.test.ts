import { SpeechService } from '../SpeechService';

// Mock Web Speech API
const mockSpeechSynthesis = {
  getVoices: jest.fn(() => [
    {
      name: 'Test Voice JP',
      lang: 'ja-JP',
      default: true,
      localService: true,
    },
    {
      name: 'Test Voice EN',
      lang: 'en-US',
      default: false,
      localService: true,
    },
  ]),
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  speaking: false,
  paused: false,
  pending: 0,
  onvoiceschanged: null,
};

const mockSpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
  text,
  voice: null,
  lang: '',
  rate: 1,
  pitch: 1,
  volume: 1,
  onend: null,
  onerror: null,
}));

Object.defineProperty(global, 'window', {
  value: {
    speechSynthesis: mockSpeechSynthesis,
    SpeechSynthesisUtterance: mockSpeechSynthesisUtterance,
  },
  writable: true,
});

describe('SpeechService', () => {
  let service: SpeechService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SpeechService();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(service).toBeInstanceOf(SpeechService);
    });

    it('should check if speech synthesis is supported', () => {
      const isSupported = service.isSupported();
      expect(isSupported).toBe(true);
    });
  });

  describe('voice management', () => {
    it('should get available voices', () => {
      const voices = service.getAvailableVoices();
      expect(voices).toHaveLength(2);
      expect(voices[0].name).toBe('Test Voice JP');
      expect(voices[0].lang).toBe('ja-JP');
    });

    it('should filter voices by language', () => {
      const japanesVoices = service.getAvailableVoices('ja');
      expect(japanesVoices).toHaveLength(1);
      expect(japanesVoices[0].lang).toBe('ja-JP');
    });

    it('should get best voice for language', () => {
      const bestVoice = service.getBestVoice('ja');
      expect(bestVoice?.lang).toBe('ja-JP');
    });

    it('should return null when no voice found', () => {
      mockSpeechSynthesis.getVoices.mockReturnValue([]);
      const newService = new SpeechService();
      const bestVoice = newService.getBestVoice('ja');
      expect(bestVoice).toBeNull();
    });
  });

  describe('speech synthesis', () => {
    it('should speak text successfully', async () => {
      const mockUtterance = { onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValue(mockUtterance);

      const speakPromise = service.speak('こんにちは', { language: 'ja' });

      // Simulate successful speech end
      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 10);

      await expect(speakPromise).resolves.toBeUndefined();
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should handle speech synthesis error', async () => {
      const mockUtterance = { onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValue(mockUtterance);

      const speakPromise = service.speak('テスト', { language: 'ja' });

      // Simulate speech error
      setTimeout(() => {
        if (mockUtterance.onerror) {
          mockUtterance.onerror({ error: 'synthesis-failed' });
        }
      }, 10);

      await expect(speakPromise).rejects.toThrow('Speech synthesis error: synthesis-failed');
    });

    it('should throw error when synthesis not supported', async () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
      });

      const unsupportedService = new SpeechService();
      await expect(unsupportedService.speak('test')).rejects.toThrow('Speech synthesis not supported');
    });

    it('should use custom speech options', async () => {
      const mockUtterance = { 
        onend: null, 
        onerror: null,
        rate: 1,
        pitch: 1,
        volume: 1,
      };
      mockSpeechSynthesisUtterance.mockReturnValue(mockUtterance);

      const options = {
        language: 'en' as const,
        rate: 1.5,
        pitch: 0.8,
        volume: 0.9,
      };

      const speakPromise = service.speak('Hello', options);

      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 10);

      await speakPromise;

      expect(mockUtterance.rate).toBe(1.5);
      expect(mockUtterance.pitch).toBe(0.8);
      expect(mockUtterance.volume).toBe(0.9);
    });
  });

  describe('speech control', () => {
    it('should pause speech', () => {
      service.pause();
      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();
    });

    it('should resume speech', () => {
      service.resume();
      expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
    });

    it('should cancel speech', () => {
      service.cancel();
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should check if speaking', () => {
      mockSpeechSynthesis.speaking = true;
      expect(service.isSpeaking()).toBe(true);

      mockSpeechSynthesis.speaking = false;
      expect(service.isSpeaking()).toBe(false);
    });

    it('should check if paused', () => {
      mockSpeechSynthesis.paused = true;
      expect(service.isPaused()).toBe(true);

      mockSpeechSynthesis.paused = false;
      expect(service.isPaused()).toBe(false);
    });

    it('should get pending queue length', () => {
      mockSpeechSynthesis.pending = 3;
      expect(service.getPendingQueueLength()).toBe(3);
    });
  });

  describe('text processing', () => {
    it('should split short text into single chunk', () => {
      const text = 'これは短いテキストです。';
      const chunks = service.splitTextForSpeech(text);
      expect(chunks).toEqual([text]);
    });

    it('should split long text into multiple chunks', () => {
      const longText = 'これは非常に長いテキストです。' + 'このテキストは複数のセンテンスを含んでいます。'.repeat(10);
      const chunks = service.splitTextForSpeech(longText, 100);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });

    it('should handle text with various punctuation', () => {
      const text = 'こんにちは！今日はいい天気ですね？はい、そうですね。';
      const chunks = service.splitTextForSpeech(text, 50);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should speak long text in chunks', async () => {
      const longText = 'これは長いテキストです。'.repeat(20);
      const mockUtterance = { onend: null, onerror: null };
      mockSpeechSynthesisUtterance.mockReturnValue(mockUtterance);

      const speakPromise = service.speakLongText(longText, { language: 'ja' });

      // Simulate successful speech for each chunk
      setTimeout(() => {
        if (mockUtterance.onend) {
          mockUtterance.onend();
        }
      }, 10);

      await expect(speakPromise).resolves.toBeUndefined();
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });
  });

  describe('voice waiting', () => {
    it('should wait for voices to load', async () => {
      const result = await service.waitForVoices(100);
      expect(result).toBe(true);
    });

    it('should timeout when voices do not load', async () => {
      mockSpeechSynthesis.getVoices.mockReturnValue([]);
      const newService = new SpeechService();
      const result = await newService.waitForVoices(100);
      expect(result).toBe(false);
    });

    it('should handle voice change events', async () => {
      const newService = new SpeechService();
      
      // Simulate voices loading asynchronously
      setTimeout(() => {
        mockSpeechSynthesis.getVoices.mockReturnValue([
          { name: 'New Voice', lang: 'ja-JP', default: true, localService: true },
        ]);
        if (mockSpeechSynthesis.onvoiceschanged) {
          mockSpeechSynthesis.onvoiceschanged();
        }
      }, 50);

      const result = await newService.waitForVoices(200);
      expect(result).toBe(true);
    });
  });
});