import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';
import { OpenDataService } from '@/lib/services/OpenDataService';
import { TokyoOpenDataService } from '@/lib/services/TokyoOpenDataService';

let openDataService: OpenDataService;
let tokyoOpenDataService: TokyoOpenDataService;

async function initializeServices() {
  if (!openDataService) {
    openDataService = new OpenDataService();
  }
  if (!tokyoOpenDataService) {
    tokyoOpenDataService = new TokyoOpenDataService();
  }
}

export async function GET(request: NextRequest) {
  try {
    await initializeServices();

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const query = searchParams.get('query');
    const language = searchParams.get('language') || 'ja';
    const useDynamic = searchParams.get('dynamic') !== 'false'; // デフォルトでdynamic検索を使用

    if (query) {
      // 動的検索または従来の検索
      let searchResults;
      
      if (useDynamic) {
        // 新しい動的検索を使用
        searchResults = await tokyoOpenDataService.fetchRelevantData(
          query, 
          language as 'ja' | 'en' | 'zh' | 'ko'
        );
      } else {
        // 従来の子育て限定検索
        searchResults = await openDataService.searchChildcareInfo(query);
      }
      
      const response: ApiResponse = {
        success: true,
        data: {
          items: searchResults,
          total: searchResults.length,
          query: query,
          searchMethod: useDynamic ? 'dynamic' : 'legacy'
        }
      };

      return NextResponse.json(response, { status: 200 });
      
    } else if (category) {
      // カテゴリ別検索
      if (category === 'sources') {
        const sources = useDynamic 
          ? await tokyoOpenDataService.getAvailableDataSources()
          : await openDataService.getDataSources();
        
        const response: ApiResponse = {
          success: true,
          data: sources
        };

        return NextResponse.json(response, { status: 200 });
        
      } else if (category === 'stats') {
        // 統計情報
        const stats = await tokyoOpenDataService.getStats();
        
        const response: ApiResponse = {
          success: true,
          data: stats
        };

        return NextResponse.json(response, { status: 200 });
        
      } else {
        // 特定カテゴリのデータ
        const categoryData = await tokyoOpenDataService.searchByCategory(category);
        
        const response: ApiResponse = {
          success: true,
          data: {
            items: categoryData,
            total: categoryData.length,
            category: category
          }
        };

        return NextResponse.json(response, { status: 200 });
      }
    } else {
      // デフォルト: 従来の子育てデータまたはサンプルデータ
      const childcareData = await openDataService.fetchChildcareData();
      
      const response: ApiResponse = {
        success: true,
        data: {
          items: childcareData,
          total: childcareData.length,
          message: 'Default childcare data. Use ?query=<search_term> for dynamic search across all Tokyo Open Data.'
        }
      };

      return NextResponse.json(response, { status: 200 });
    }

  } catch (error) {
    console.error('Data API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch data',
      message: (error as Error).message
    };

    return NextResponse.json(response, { status: 500 });
  }
}