import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';
import { TokyoOpenDataService } from '@/lib/services/TokyoOpenDataService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '保育園';
    const language = searchParams.get('language') || 'ja';

    console.log(`🧪 Testing Tokyo Open Data Service with query: "${query}"`);

    const tokyoOpenDataService = new TokyoOpenDataService();
    
    // テスト1: 動的データ検索
    const startTime = Date.now();
    const results = await tokyoOpenDataService.fetchRelevantData(
      query, 
      language as 'ja' | 'en' | 'zh' | 'ko'
    );
    const searchTime = Date.now() - startTime;

    // テスト2: 統計情報取得
    const statsStartTime = Date.now();
    const stats = await tokyoOpenDataService.getStats();
    const statsTime = Date.now() - statsStartTime;

    // テスト3: データソース一覧
    const sourcesStartTime = Date.now();
    const sources = await tokyoOpenDataService.getAvailableDataSources();
    const sourcesTime = Date.now() - sourcesStartTime;

    const response: ApiResponse = {
      success: true,
      data: {
        testResults: {
          dynamicSearch: {
            query,
            language,
            resultCount: results.length,
            processingTime: searchTime,
            sampleResults: results.slice(0, 2), // 最初の2件のみ表示
            status: results.length > 0 ? 'success' : 'no-results'
          },
          statistics: {
            totalDatasets: stats.totalDatasets,
            organizationCount: stats.organizations.length,
            processingTime: statsTime,
            status: 'success'
          },
          dataSources: {
            sourceCount: sources.length,
            processingTime: sourcesTime,
            sampleSources: sources.slice(0, 3), // 最初の3件のみ表示
            status: 'success'
          }
        },
        summary: {
          totalProcessingTime: searchTime + statsTime + sourcesTime,
          allTestsPassed: results.length > 0 && stats.totalDatasets > 0 && sources.length > 0,
          timestamp: new Date().toISOString()
        }
      }
    };

    console.log(`✅ Test completed in ${searchTime + statsTime + sourcesTime}ms`);
    console.log(`📊 Results: ${results.length} items, ${stats.totalDatasets} total datasets, ${sources.length} sources`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Test failed',
      message: (error as Error).message,
      data: {
        errorDetails: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
        }
      }
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testQueries } = body;

    if (!Array.isArray(testQueries) || testQueries.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'testQueries array is required'
      }, { status: 400 });
    }

    const tokyoOpenDataService = new TokyoOpenDataService();
    const results = [];

    console.log(`🧪 Running batch test with ${testQueries.length} queries`);

    for (const [index, testQuery] of testQueries.entries()) {
      try {
        const startTime = Date.now();
        const searchResults = await tokyoOpenDataService.fetchRelevantData(
          testQuery.query || testQuery,
          testQuery.language || 'ja'
        );
        const processingTime = Date.now() - startTime;

        results.push({
          index,
          query: testQuery.query || testQuery,
          language: testQuery.language || 'ja',
          resultCount: searchResults.length,
          processingTime,
          success: true,
          sampleResult: searchResults[0] || null
        });

        console.log(`✅ Query ${index + 1}/${testQueries.length}: "${testQuery.query || testQuery}" → ${searchResults.length} results (${processingTime}ms)`);
        
      } catch (error) {
        results.push({
          index,
          query: testQuery.query || testQuery,
          language: testQuery.language || 'ja',
          success: false,
          error: (error as Error).message
        });

        console.log(`❌ Query ${index + 1}/${testQueries.length}: "${testQuery.query || testQuery}" → Error: ${(error as Error).message}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0);

    const response: ApiResponse = {
      success: true,
      data: {
        batchTestResults: results,
        summary: {
          totalQueries: testQueries.length,
          successCount,
          failureCount: testQueries.length - successCount,
          successRate: (successCount / testQueries.length) * 100,
          totalProcessingTime: totalTime,
          averageProcessingTime: totalTime / testQueries.length,
          timestamp: new Date().toISOString()
        }
      }
    };

    console.log(`🎯 Batch test completed: ${successCount}/${testQueries.length} queries successful (${((successCount / testQueries.length) * 100).toFixed(1)}%)`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ Batch test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Batch test failed',
      message: (error as Error).message
    }, { status: 500 });
  }
}