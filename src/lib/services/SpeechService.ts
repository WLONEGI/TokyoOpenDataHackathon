// Browser-based speech synthesis service using Web Speech API
import { SupportedLanguage } from '@/types';

export interface SpeechOptions {
  language: SupportedLanguage;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface VoiceInfo {
  name: string;
  lang: string;
  isDefault: boolean;
  isLocalService: boolean;
}

export class SpeechService {
  private synthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    this.initializeSpeechSynthesis();
  }

  private initializeSpeechSynthesis(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
      
      // Listen for voice changes (some browsers load voices asynchronously)
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoices(): void {
    if (!this.synthesis) return;
    
    this.voices = this.synthesis.getVoices();
    this.isInitialized = true;
  }

  public isSupported(): boolean {
    return this.synthesis !== null;
  }

  public async waitForVoices(timeout: number = 3000): Promise<boolean> {
    if (!this.synthesis) return false;
    
    return new Promise((resolve) => {
      const checkVoices = () => {
        if (this.voices.length > 0) {
          resolve(true);
          return;
        }
        
        this.loadVoices();
        if (this.voices.length > 0) {
          resolve(true);
        }
      };
      
      checkVoices();
      
      const timeoutId = setTimeout(() => {
        resolve(this.voices.length > 0);
      }, timeout);
      
      if (this.synthesis!.onvoiceschanged !== undefined) {
        this.synthesis!.onvoiceschanged = () => {
          this.loadVoices();
          if (this.voices.length > 0) {
            clearTimeout(timeoutId);
            resolve(true);
          }
        };
      }
    });
  }

  public getAvailableVoices(language?: SupportedLanguage): VoiceInfo[] {
    if (!this.isInitialized || this.voices.length === 0) {
      this.loadVoices();
    }

    const languageMap: Record<SupportedLanguage, string[]> = {
      ja: ['ja-JP', 'ja'],
      en: ['en-US', 'en-GB', 'en-CA', 'en-AU', 'en'],
      zh: ['zh-CN', 'zh-TW', 'zh-HK', 'zh'],
      ko: ['ko-KR', 'ko'],
    };

    let filteredVoices = this.voices;

    if (language && languageMap[language]) {
      const targetLangs = languageMap[language];
      filteredVoices = this.voices.filter(voice =>
        targetLangs.some(lang => voice.lang.toLowerCase().startsWith(lang.toLowerCase()))
      );
    }

    return filteredVoices.map(voice => ({
      name: voice.name,
      lang: voice.lang,
      isDefault: voice.default,
      isLocalService: voice.localService,
    }));
  }

  public getBestVoice(language: SupportedLanguage): SpeechSynthesisVoice | null {
    const languageMap: Record<SupportedLanguage, string[]> = {
      ja: ['ja-JP', 'ja'],
      en: ['en-US', 'en-GB', 'en'],
      zh: ['zh-CN', 'zh-TW', 'zh'],
      ko: ['ko-KR', 'ko'],
    };

    const targetLangs = languageMap[language];
    
    // First, try to find a voice that matches the exact language
    for (const targetLang of targetLangs) {
      const voice = this.voices.find(v => 
        v.lang.toLowerCase().startsWith(targetLang.toLowerCase())
      );
      if (voice) return voice;
    }

    // Fall back to default voice
    return this.voices.find(v => v.default) || this.voices[0] || null;
  }

  public async speak(text: string, options: SpeechOptions = { language: 'ja' }): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Speech synthesis not supported in this browser');
    }

    // Ensure voices are loaded
    await this.waitForVoices();

    return new Promise((resolve, reject) => {
      // Cancel any ongoing speech
      this.synthesis!.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice
      const voice = this.getBestVoice(options.language);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        // Set language even if no specific voice is found
        const langMap: Record<SupportedLanguage, string> = {
          ja: 'ja-JP',
          en: 'en-US',
          zh: 'zh-CN',
          ko: 'ko-KR',
        };
        utterance.lang = langMap[options.language] || 'ja-JP';
      }

      // Set speech parameters
      utterance.rate = options.rate ?? 1.0;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      // Set event listeners
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      // Start speaking
      this.synthesis!.speak(utterance);
    });
  }

  public pause(): void {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  public resume(): void {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }

  public cancel(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false;
  }

  public isPaused(): boolean {
    return this.synthesis ? this.synthesis.paused : false;
  }

  public getPendingQueueLength(): number {
    return this.synthesis && typeof this.synthesis.pending === 'number' ? this.synthesis.pending : 0;
  }

  // Utility method to split long text into chunks for better speech synthesis
  public splitTextForSpeech(text: string, maxLength: number = 200): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/[.!?。！？]/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if (currentChunk.length + trimmedSentence.length + 1 <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = trimmedSentence;
        } else {
          // If a single sentence is too long, split by commas or spaces
          const words = trimmedSentence.split(/[,、]/);
          for (const word of words) {
            const trimmedWord = word.trim();
            if (!trimmedWord) continue;

            if (currentChunk.length + trimmedWord.length + 1 <= maxLength) {
              currentChunk += (currentChunk ? ' ' : '') + trimmedWord;
            } else {
              if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = trimmedWord;
              } else {
                // Force split if even a single word is too long
                chunks.push(trimmedWord.substring(0, maxLength));
                currentChunk = trimmedWord.substring(maxLength);
              }
            }
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [text];
  }

  // Speak long text by chunking it
  public async speakLongText(text: string, options: SpeechOptions = { language: 'ja' }): Promise<void> {
    const chunks = this.splitTextForSpeech(text);
    
    for (const chunk of chunks) {
      await this.speak(chunk, options);
      // Small pause between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Singleton instance for browser usage
let speechServiceInstance: SpeechService | null = null;

export const getSpeechService = (): SpeechService => {
  if (!speechServiceInstance) {
    speechServiceInstance = new SpeechService();
  }
  return speechServiceInstance;
};

// React hook for using speech service
export const useSpeechSynthesis = () => {
  const speechService = getSpeechService();

  return {
    speak: speechService.speak.bind(speechService),
    speakLongText: speechService.speakLongText.bind(speechService),
    pause: speechService.pause.bind(speechService),
    resume: speechService.resume.bind(speechService),
    cancel: speechService.cancel.bind(speechService),
    isSpeaking: speechService.isSpeaking.bind(speechService),
    isPaused: speechService.isPaused.bind(speechService),
    isSupported: speechService.isSupported.bind(speechService),
    getAvailableVoices: speechService.getAvailableVoices.bind(speechService),
    getBestVoice: speechService.getBestVoice.bind(speechService),
  };
};