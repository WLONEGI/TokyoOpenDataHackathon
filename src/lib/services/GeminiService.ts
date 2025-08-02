import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/lib/config';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!config.geminiApiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  async generateText(prompt: string, context?: string): Promise<string> {
    try {
      const fullPrompt = context 
        ? `Context: ${context}\n\nUser Question: ${prompt}\n\nPlease provide a helpful and accurate response based on the context provided. If the context doesn't contain relevant information, please say so and provide general guidance.`
        : prompt;

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating text with Gemini:', error);
      throw new Error('Failed to generate response');
    }
  }

  async processAudio(audioData: string, mimeType: string): Promise<string> {
    try {
      // Convert base64 to buffer if needed
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      const result = await this.model.generateContent([
        {
          inlineData: {
            data: audioData,
            mimeType: mimeType
          }
        },
        'Please transcribe this audio to text. Respond only with the transcribed text.'
      ]);
      
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error processing audio with Gemini:', error);
      throw new Error('Failed to process audio');
    }
  }

  async generateSpeech(text: string, language: string = 'ja'): Promise<string> {
    try {
      // Note: Gemini doesn't have direct text-to-speech yet
      // This is a placeholder for future implementation
      // You might want to use Web Speech API on the client side instead
      
      const prompt = `Generate audio for the following text in ${language}: "${text}"`;
      
      const result = await this.model.generateContent([
        prompt,
        'Please generate speech audio for this text. Return the audio as base64 encoded data.'
      ]);
      
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating speech with Gemini:', error);
      // Return empty string as fallback - client will use Web Speech API
      return '';
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      // Use Gemini's embedding model
      const embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embeddings with Gemini:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  async analyzeIntent(message: string): Promise<{
    intent: string;
    entities: Record<string, any>;
    confidence: number;
  }> {
    try {
      const prompt = `
Analyze the following user message and extract:
1. Intent (one of: greeting, question, request_info, complaint, thanks, goodbye, childcare_info, disaster_info, general_info)
2. Entities (key information like location, facility type, age, etc.)
3. Confidence score (0-1)

User message: "${message}"

Respond in JSON format:
{
  "intent": "intent_name",
  "entities": {"key": "value"},
  "confidence": 0.95
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        return JSON.parse(text);
      } catch {
        // Fallback if JSON parsing fails
        return {
          intent: 'question',
          entities: {},
          confidence: 0.5
        };
      }
    } catch (error) {
      console.error('Error analyzing intent with Gemini:', error);
      return {
        intent: 'question',
        entities: {},
        confidence: 0.5
      };
    }
  }
}