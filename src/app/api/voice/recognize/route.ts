import { NextRequest, NextResponse } from 'next/server';
import { VoiceRequest, VoiceResponse, ApiResponse } from '@/types';
import { GeminiService } from '@/lib/services/GeminiService';

let geminiService: GeminiService;

async function initializeService() {
  if (!geminiService) {
    geminiService = new GeminiService();
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeService();

    const body: VoiceRequest = await request.json();
    const { audioData, mimeType, sessionId, language = 'ja' } = body;

    if (!audioData || !mimeType || !sessionId) {
      const response: ApiResponse = {
        success: false,
        error: 'audioData, mimeType, and sessionId are required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    try {
      // Use Gemini to transcribe audio
      const transcribedText = await geminiService.processAudio(audioData, mimeType);

      if (!transcribedText || transcribedText.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Failed to transcribe audio - no text detected',
        };
        return NextResponse.json(response, { status: 400 });
      }

      const voiceResponse: VoiceResponse = {
        text: transcribedText.trim(),
      };

      const response: ApiResponse<VoiceResponse> = {
        success: true,
        data: voiceResponse,
        message: 'Audio transcribed successfully',
      };

      return NextResponse.json(response, { status: 200 });

    } catch (error) {
      console.error('Voice recognition error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: 'Failed to process audio recognition',
      };

      return NextResponse.json(response, { status: 500 });
    }

  } catch (error) {
    console.error('Voice API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to process voice request',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}