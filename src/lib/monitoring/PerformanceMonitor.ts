// Performance monitoring and metrics collection
import { log } from '../logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceSummary {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  unit: string;
  timeWindow: string;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private readonly maxMetricsPerType = 1000;
  private readonly cleanupInterval = 60 * 60 * 1000; // 1 hour
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.cleanupInterval);
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let totalRemoved = 0;

    for (const [metricName, metrics] of this.metrics.entries()) {
      const before = metrics.length;
      const filtered = metrics.filter(metric => metric.timestamp > oneHourAgo);
      this.metrics.set(metricName, filtered);
      totalRemoved += before - filtered.length;
    }

    if (totalRemoved > 0) {
      log.debug(`Performance metrics cleanup: removed ${totalRemoved} old metrics`);
    }
  }

  recordMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metrics = this.metrics.get(metric.name)!;
    metrics.push(metric);

    // Keep only the most recent metrics to prevent memory growth
    if (metrics.length > this.maxMetricsPerType) {
      metrics.splice(0, metrics.length - this.maxMetricsPerType);
    }
  }

  recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value: durationMs,
      unit: 'ms',
      timestamp: new Date(),
      tags,
    });
  }

  recordCount(name: string, count: number = 1, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value: count,
      unit: 'count',
      timestamp: new Date(),
      tags,
    });
  }

  recordMemory(name: string, bytes: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value: bytes,
      unit: 'bytes',
      timestamp: new Date(),
      tags,
    });
  }

  recordPercentage(name: string, percentage: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value: Math.max(0, Math.min(100, percentage)),
      unit: 'percentage',
      timestamp: new Date(),
      tags,
    });
  }

  // Create a timing decorator for async functions
  time<T extends any[], R>(
    name: string, 
    tags?: Record<string, string>
  ): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args: T): Promise<R> {
        const start = Date.now();
        try {
          const result = await originalMethod.apply(this, args);
          const duration = Date.now() - start;
          getPerformanceMonitor().recordTiming(name, duration, tags);
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          getPerformanceMonitor().recordTiming(name, duration, { ...tags, error: 'true' });
          throw error;
        }
      };

      return descriptor;
    };
  }

  // Manual timing utility
  startTimer(name: string, tags?: Record<string, string>): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordTiming(name, duration, tags);
      return duration;
    };
  }

  getSummary(metricName: string, timeWindowMs: number = 5 * 60 * 1000): PerformanceSummary | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const cutoff = new Date(Date.now() - timeWindowMs);
    const recentMetrics = metrics
      .filter(metric => metric.timestamp > cutoff)
      .map(metric => metric.value)
      .sort((a, b) => a - b);

    if (recentMetrics.length === 0) {
      return null;
    }

    const sum = recentMetrics.reduce((acc, val) => acc + val, 0);
    const avg = sum / recentMetrics.length;
    const min = recentMetrics[0];
    const max = recentMetrics[recentMetrics.length - 1];

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * recentMetrics.length) - 1;
      return recentMetrics[Math.max(0, index)];
    };

    const firstMetric = metrics[0];
    const timeWindowMinutes = Math.round(timeWindowMs / (1000 * 60));

    return {
      name: metricName,
      count: recentMetrics.length,
      min,
      max,
      avg: Number(avg.toFixed(2)),
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      unit: firstMetric.unit,
      timeWindow: `${timeWindowMinutes}m`,
    };
  }

  getAllSummaries(timeWindowMs: number = 5 * 60 * 1000): PerformanceSummary[] {
    const summaries: PerformanceSummary[] = [];
    
    for (const metricName of this.metrics.keys()) {
      const summary = this.getSummary(metricName, timeWindowMs);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  getMetrics(metricName: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName);
    if (!metrics) {
      return [];
    }

    return metrics.slice(-limit);
  }

  getTopSlowestOperations(limit: number = 10, timeWindowMs: number = 5 * 60 * 1000): Array<{
    name: string;
    maxDuration: number;
    avgDuration: number;
    count: number;
  }> {
    const summaries = this.getAllSummaries(timeWindowMs)
      .filter(summary => summary.unit === 'ms')
      .sort((a, b) => b.max - a.max)
      .slice(0, limit);

    return summaries.map(summary => ({
      name: summary.name,
      maxDuration: summary.max,
      avgDuration: summary.avg,
      count: summary.count,
    }));
  }

  // System performance monitoring
  recordSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory metrics
    this.recordMemory('system.memory.heapUsed', memUsage.heapUsed);
    this.recordMemory('system.memory.heapTotal', memUsage.heapTotal);
    this.recordMemory('system.memory.external', memUsage.external);
    this.recordMemory('system.memory.rss', memUsage.rss);
    
    // Memory usage percentage
    const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.recordPercentage('system.memory.usage', memoryPercentage);
    
    // CPU metrics (note: these are cumulative, would need baseline for rates)
    this.recordMetric({
      name: 'system.cpu.user',
      value: cpuUsage.user / 1000, // Convert to milliseconds
      unit: 'ms',
      timestamp: new Date(),
    });
    
    this.recordMetric({
      name: 'system.cpu.system',
      value: cpuUsage.system / 1000,
      unit: 'ms',
      timestamp: new Date(),
    });

    // Uptime
    this.recordMetric({
      name: 'system.uptime',
      value: process.uptime(),
      unit: 'count',
      timestamp: new Date(),
    });
  }

  // Event loop lag measurement
  measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        this.recordTiming('system.eventLoopLag', lag);
        resolve(lag);
      });
    });
  }

  // Start automatic system monitoring
  startSystemMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      this.recordSystemMetrics();
      this.measureEventLoopLag();
    }, intervalMs);
  }

  getStats(): {
    metricTypes: number;
    totalMetrics: number;
    oldestMetric: Date | null;
    newestMetric: Date | null;
  } {
    let totalMetrics = 0;
    let oldestMetric: Date | null = null;
    let newestMetric: Date | null = null;

    for (const metrics of this.metrics.values()) {
      totalMetrics += metrics.length;
      
      if (metrics.length > 0) {
        const first = metrics[0].timestamp;
        const last = metrics[metrics.length - 1].timestamp;
        
        if (!oldestMetric || first < oldestMetric) {
          oldestMetric = first;
        }
        
        if (!newestMetric || last > newestMetric) {
          newestMetric = last;
        }
      }
    }

    return {
      metricTypes: this.metrics.size,
      totalMetrics,
      oldestMetric,
      newestMetric,
    };
  }

  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.metrics.clear();
    log.info('Performance monitor cleanup completed');
  }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitor | null = null;

export const getPerformanceMonitor = (): PerformanceMonitor => {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
};

// Convenience function for timing operations
export const withTiming = async <T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> => {
  const monitor = getPerformanceMonitor();
  const endTimer = monitor.startTimer(name, tags);
  
  try {
    const result = await operation();
    endTimer();
    return result;
  } catch (error) {
    endTimer();
    throw error;
  }
};

export { PerformanceMonitor };