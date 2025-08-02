import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, ChatResponse, ApiResponse } from '@/types';
import { GeminiService } from '@/lib/services/GeminiService';
import { VectorSearchService } from '@/lib/services/VectorSearchService';

let geminiService: GeminiService;
let vectorSearchService: VectorSearchService;

// Initialize services
async function initializeServices() {
  if (!geminiService) {
    geminiService = new GeminiService();
  }
  if (!vectorSearchService) {
    vectorSearchService = new VectorSearchService();
    try {
      await vectorSearchService.initializeIndex();
    } catch (error) {
      console.error('Failed to initialize vector search index:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeServices();

    const body: ChatRequest = await request.json();
    const { message, sessionId, language = 'ja', useVoice = false } = body;

    if (!message || !sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'Message and sessionId are required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Search for relevant information
    let context = '';
    let sources: any[] = [];

    try {
      const searchResult = await vectorSearchService.search({
        text: message,
        language,
        limit: 3
      });

      if (searchResult.items.length > 0) {
        context = searchResult.items
          .map(item => `${item.title}: ${item.content}`)
          .join('\n\n');
        
        sources = searchResult.items.map(item => ({
          id: item.id,
          title: item.title,
          url: item.metadata.source,
          description: item.description,
          category: item.category,
          lastUpdated: item.metadata.lastUpdated
        }));
      }
    } catch (error) {
      console.error('Search failed:', error);
      // Continue without search results
    }

    // Generate response using Gemini
    let responseText: string;
    try {
      if (context) {
        responseText = await geminiService.generateText(message, context);
      } else {
        // Fallback prompt for childcare-related queries
        const fallbackPrompt = `あなたは東京都の子育て支援に関する情報をお答えするAIアシスタントです。\n\nユーザーの質問: ${message}\n\n東京都の子育て支援制度、保育園、学童保育、子ども食堂などに関する一般的な情報を提供してください。具体的な手続きについては、各区市町村の窓口へのお問い合わせを案内してください。`;
        responseText = await geminiService.generateText(fallbackPrompt);
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      responseText = '申し訳ございませんが、現在サービスに問題が発生しています。しばらく後にもう一度お試しください。';
    }

    // Generate audio if requested
    let audioUrl: string | undefined;
    if (useVoice) {
      try {
        audioUrl = await geminiService.generateSpeech(responseText, language);
      } catch (error) {
        console.error('Speech generation failed:', error);
        // Continue without audio
      }
    }

    const chatResponse: ChatResponse = {
      response: responseText,
      audioUrl,
      sources: sources.length > 0 ? sources : undefined
    };

    const response: ApiResponse<ChatResponse> = {
      success: true,
      data: chatResponse,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Chat API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to process chat request',
    };

    return NextResponse.json(response, { status: 500 });
  }
}