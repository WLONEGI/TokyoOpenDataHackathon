import { NextRequest, NextResponse } from 'next/server';
import { getHealthMonitor } from '@/lib/monitoring/HealthMonitor';
import { ServiceManager } from '@/lib/services/ServiceManager';
import { log, generateRequestId, logger } from '@/lib/logger';
import { getSearchCache } from '@/lib/cache/SearchCache';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const timer = log.performance('Health Check API', requestId);
  
  try {
    const healthMonitor = getHealthMonitor();
    const serviceManager = ServiceManager.getInstance();
    const searchCache = getSearchCache();
    
    // Run comprehensive health checks
    const systemHealth = await healthMonitor.runHealthChecks();
    
    // Add service-specific health info
    const serviceStats = serviceManager.getStats();
    const cacheStats = searchCache.getStats();
    const logStats = logger.getStats();
    
    const detailedHealth = {
      ...systemHealth,
      services: {
        ...serviceStats,
        cache: cacheStats,
        logging: logStats,
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV,
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      },
      configuration: {
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        hasRedisUrl: !!process.env.REDIS_URL,
        logLevel: process.env.LOG_LEVEL || 'INFO',
      },
    };
    
    const duration = timer.end({
      overall: systemHealth.overall,
      checkCount: Object.keys(systemHealth.checks).length,
    });
    
    log.api('GET', '/api/health', 200, duration, requestId);
    
    // Return appropriate status code based on health
    const statusCode = systemHealth.overall === 'healthy' ? 200 : 
                      systemHealth.overall === 'degraded' ? 200 : 503;
    
    return NextResponse.json(detailedHealth, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    const duration = timer.end({ error: true });
    
    log.error('Health check failed', error as Error, undefined, requestId);
    log.api('GET', '/api/health', 500, duration, requestId);
    
    return NextResponse.json(
      { 
        overall: 'unhealthy',
        error: 'Health check system failure',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }, 
      { status: 500 }
    );
  }
}

// Simple liveness probe endpoint
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}