import { NextRequest, NextResponse } from 'next/server';
import { SearchQuery, ApiResponse } from '@/types';
import { VectorSearchService } from '@/lib/services/VectorSearchService';

let vectorSearchService: VectorSearchService;

async function initializeService() {
  if (!vectorSearchService) {
    vectorSearchService = new VectorSearchService();
    try {
      await vectorSearchService.initializeIndex();
    } catch (error) {
      console.error('Failed to initialize search service:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeService();

    const body: SearchQuery = await request.json();
    const { text, category, language = 'ja', limit = 10 } = body;

    if (!text) {
      const response: ApiResponse = {
        success: false,
        error: 'Search text is required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const searchResult = await vectorSearchService.search({
      text,
      category,
      language,
      limit
    });

    const response: ApiResponse = {
      success: true,
      data: searchResult,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Search API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to perform search',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await initializeService();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = vectorSearchService.getStats();
      
      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      return NextResponse.json(response, { status: 200 });
    } else if (action === 'recommendations') {
      const query = searchParams.get('query') || '';
      const limit = parseInt(searchParams.get('limit') || '3');
      
      const recommendations = await vectorSearchService.getRecommendations(query, limit);
      
      const response: ApiResponse = {
        success: true,
        data: {
          items: recommendations,
          total: recommendations.length
        },
      };

      return NextResponse.json(response, { status: 200 });
    } else {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid action parameter',
      };

      return NextResponse.json(response, { status: 400 });
    }

  } catch (error) {
    console.error('Search GET API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to process search request',
    };

    return NextResponse.json(response, { status: 500 });
  }
}