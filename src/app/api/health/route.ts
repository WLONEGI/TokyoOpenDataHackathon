import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import RedisService from '@/lib/services/RedisService';
import GeminiService from '@/lib/services/GeminiService';

// ヘルスチェック API
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = uuidv4();

  try {
    // 各サービスのヘルスチェック
    const [redisHealth, geminiHealth] = await Promise.allSettled([
      RedisService.healthCheck(),
      GeminiService.healthCheck(),
    ]);

    // システムメトリクス取得
    const metrics = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
      activeConnections: 0, // TODO: 実際の接続数取得
    };

    // サービスステータス判定
    const services = {
      redis: redisHealth.status === 'fulfilled' ? redisHealth.value : {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: redisHealth.status === 'rejected' ? redisHealth.reason?.message : 'Unknown error',
      },
      gemini: geminiHealth.status === 'fulfilled' ? geminiHealth.value : {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: geminiHealth.status === 'rejected' ? geminiHealth.reason?.message : 'Unknown error',
      },
      vectorSearch: {
        status: 'healthy', // TODO: 実際のVector Search接続チェック
        responseTime: 50,
        lastCheck: new Date().toISOString(),
      },
      cloudStorage: {
        status: 'healthy', // TODO: 実際のCloud Storage接続チェック
        responseTime: 30,
        lastCheck: new Date().toISOString(),
      },
    };

    // 全体ステータス判定
    const overallStatus = determineOverallStatus(services);

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services,
      metrics,
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json({
      success: true,
      data: healthResponse,
      timestamp: new Date().toISOString(),
      requestId,
    }, { status: statusCode });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ヘルスチェック中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    }, { status: 500 });
  }
}

// 全体ステータス判定
function determineOverallStatus(services: any): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(services).map((service: any) => service.status);
  
  const healthyCount = statuses.filter(status => status === 'healthy').length;
  const unhealthyCount = statuses.filter(status => status === 'unhealthy').length;
  
  if (unhealthyCount === 0) {
    return 'healthy';
  } else if (unhealthyCount === statuses.length) {
    return 'unhealthy';
  } else {
    return 'degraded';
  }
}