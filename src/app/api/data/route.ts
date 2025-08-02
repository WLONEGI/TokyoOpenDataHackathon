import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';
import { OpenDataService } from '@/lib/services/OpenDataService';

let openDataService: OpenDataService;

async function initializeService() {
  if (!openDataService) {
    openDataService = new OpenDataService();
  }
}

export async function GET(request: NextRequest) {
  try {
    await initializeService();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const query = searchParams.get('query');

    if (query) {
      // Search for specific information
      const searchResults = await openDataService.searchChildcareInfo(query);
      
      const response: ApiResponse = {
        success: true,
        data: {
          items: searchResults,
          total: searchResults.length,
          query: query
        }
      };

      return NextResponse.json(response, { status: 200 });
    } else {
      // Get all childcare data or data sources
      if (category === 'sources') {
        const sources = await openDataService.getDataSources();
        
        const response: ApiResponse = {
          success: true,
          data: sources
        };

        return NextResponse.json(response, { status: 200 });
      } else {
        const childcareData = await openDataService.fetchChildcareData();
        
        const response: ApiResponse = {
          success: true,
          data: {
            items: childcareData,
            total: childcareData.length
          }
        };

        return NextResponse.json(response, { status: 200 });
      }
    }

  } catch (error) {
    console.error('Data API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch data',
    };

    return NextResponse.json(response, { status: 500 });
  }
}