// Health monitoring and alerting system
import { log } from '../logger';

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthStatus>;
  critical: boolean;
  timeout: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  responseTime?: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthStatus>;
  timestamp: Date;
  uptime: number;
}

export interface AlertRule {
  name: string;
  condition: (health: SystemHealth) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // minutes
  action: (health: SystemHealth) => Promise<void>;
}

class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private lastAlerts: Map<string, Date> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly checkInterval: number = 60000; // 1 minute

  constructor() {
    this.setupDefaultChecks();
    this.setupDefaultAlerts();
  }

  private setupDefaultChecks(): void {
    // Memory usage check
    this.addHealthCheck({
      name: 'memory',
      critical: true,
      timeout: 5000,
      check: async () => {
        const usage = process.memoryUsage();
        const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
        const percentage = (usage.heapUsed / usage.heapTotal) * 100;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        let message = `Memory usage: ${usedMB}MB / ${totalMB}MB (${percentage.toFixed(1)}%)`;

        // Adjust thresholds for development environment
        const isDevelopment = process.env.NODE_ENV === 'development';
        const criticalThreshold = isDevelopment ? 95 : 85;
        const warningThreshold = isDevelopment ? 85 : 70;

        if (percentage > criticalThreshold) {
          status = 'unhealthy';
          message += ' - Critical memory usage';
        } else if (percentage > warningThreshold) {
          status = 'degraded';
          message += ' - High memory usage';
        }

        return {
          status,
          message,
          details: {
            heapUsed: usedMB,
            heapTotal: totalMB,
            percentage: percentage.toFixed(1),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024),
          },
          timestamp: new Date(),
        };
      },
    });

    // CPU/Event loop lag check
    this.addHealthCheck({
      name: 'eventLoop',
      critical: false,
      timeout: 5000,
      check: async () => {
        return new Promise((resolve) => {
          const start = process.hrtime.bigint();
          setImmediate(() => {
            const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
            
            let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
            let message = `Event loop lag: ${lag.toFixed(2)}ms`;

            if (lag > 100) {
              status = 'unhealthy';
              message += ' - Severe event loop lag';
            } else if (lag > 50) {
              status = 'degraded';
              message += ' - High event loop lag';
            }

            resolve({
              status,
              message,
              details: { lagMs: lag.toFixed(2) },
              timestamp: new Date(),
              responseTime: lag,
            });
          });
        });
      },
    });

    // Uptime check
    this.addHealthCheck({
      name: 'uptime',
      critical: false,
      timeout: 1000,
      check: async () => {
        const uptimeSeconds = process.uptime();
        const uptimeHours = uptimeSeconds / 3600;

        return {
          status: 'healthy' as const,
          message: `Uptime: ${uptimeHours.toFixed(2)} hours`,
          details: {
            seconds: uptimeSeconds,
            hours: uptimeHours.toFixed(2),
          },
          timestamp: new Date(),
        };
      },
    });

    // Error rate check (based on logs)
    this.addHealthCheck({
      name: 'errorRate',
      critical: true,
      timeout: 5000,
      check: async () => {
        try {
          // For now, we'll monitor system health indirectly since log access is not available
          const memoryUsage = process.memoryUsage();
          const highMemoryUsage = memoryUsage.heapUsed > 500 * 1024 * 1024; // 500MB
          // Simplified health check without log access
          const errorRate = 0; // Placeholder
          
          let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
          let message = `Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`;

          if (highMemoryUsage) {
            status = 'degraded';
            message += ' - High memory usage';
          }

          return {
            status,
            message,
            details: {
              memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              memoryLimitMB: 500,
              highMemoryUsage,
            },
            timestamp: new Date(),
          };
        } catch (error) {
          return {
            status: 'unhealthy' as const,
            message: 'Failed to check error rate',
            details: { error: (error as Error).message },
            timestamp: new Date(),
          };
        }
      },
    });
  }

  private setupDefaultAlerts(): void {
    // Critical memory alert
    this.addAlertRule({
      name: 'criticalMemory',
      severity: 'critical',
      cooldown: 5, // 5 minutes
      condition: (health) => health.checks.memory?.status === 'unhealthy',
      action: async (health) => {
        log.fatal('Critical memory usage detected', undefined, {
          memoryDetails: health.checks.memory?.details,
          timestamp: new Date().toISOString(),
        });
        
        // In production, this could send alerts to Slack, email, etc.
        console.error('🚨 CRITICAL ALERT: Memory usage is critically high!');
      },
    });

    // High error rate alert
    this.addAlertRule({
      name: 'highErrorRate',
      severity: 'high',
      cooldown: 10, // 10 minutes
      condition: (health) => health.checks.errorRate?.status === 'unhealthy',
      action: async (health) => {
        log.error('High error rate detected', undefined, {
          errorDetails: health.checks.errorRate?.details,
          timestamp: new Date().toISOString(),
        });
        
        console.error('⚠️ HIGH ALERT: Error rate is elevated!');
      },
    });

    // System degradation alert
    this.addAlertRule({
      name: 'systemDegradation',
      severity: 'medium',
      cooldown: 15, // 15 minutes
      condition: (health) => health.overall === 'degraded',
      action: async (health) => {
        const degradedChecks = Object.entries(health.checks)
          .filter(([, status]) => status.status === 'degraded')
          .map(([name]) => name);

        log.warn('System performance degradation detected', {
          degradedChecks,
          timestamp: new Date().toISOString(),
        });
        
        console.warn(`⚠️ WARNING: System degradation detected in: ${degradedChecks.join(', ')}`);
      },
    });
  }

  addHealthCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    log.info(`Health check added: ${check.name}`, {
      critical: check.critical,
      timeout: check.timeout,
    });
  }

  removeHealthCheck(name: string): boolean {
    const removed = this.checks.delete(name);
    if (removed) {
      log.info(`Health check removed: ${name}`);
    }
    return removed;
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.name, rule);
    log.info(`Alert rule added: ${rule.name}`, {
      severity: rule.severity,
      cooldown: rule.cooldown,
    });
  }

  removeAlertRule(name: string): boolean {
    const removed = this.alertRules.delete(name);
    if (removed) {
      log.info(`Alert rule removed: ${name}`);
    }
    return removed;
  }

  async runHealthChecks(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checkResults: Record<string, HealthStatus> = {};
    
    log.debug('Running health checks', { checkCount: this.checks.size });

    // Run all health checks concurrently
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      try {
        const checkStart = Date.now();
        const timeoutPromise = new Promise<HealthStatus>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
        });

        const result = await Promise.race([check.check(), timeoutPromise]);
        result.responseTime = Date.now() - checkStart;
        
        return [name, result] as [string, HealthStatus];
      } catch (error) {
        log.error(`Health check failed: ${name}`, error as Error);
        return [name, {
          status: 'unhealthy' as const,
          message: `Check failed: ${(error as Error).message}`,
          timestamp: new Date(),
        }] as [string, HealthStatus];
      }
    });

    const results = await Promise.allSettled(checkPromises);
    
    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [name, status] = result.value;
        checkResults[name] = status;
      } else {
        log.error('Health check promise rejected', result.reason);
      }
    });

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const hasUnhealthy = Object.values(checkResults).some(check => check.status === 'unhealthy');
    const hasDegraded = Object.values(checkResults).some(check => check.status === 'degraded');
    const hasCriticalUnhealthy = Array.from(this.checks.entries())
      .filter(([name, check]) => check.critical && checkResults[name]?.status === 'unhealthy')
      .length > 0;

    if (hasUnhealthy && hasCriticalUnhealthy) {
      overall = 'unhealthy';
    } else if (hasUnhealthy || hasDegraded) {
      overall = 'degraded';
    }

    const systemHealth: SystemHealth = {
      overall,
      checks: checkResults,
      timestamp: new Date(),
      uptime: process.uptime(),
    };

    const totalTime = Date.now() - startTime;
    log.info(`Health checks completed in ${totalTime}ms`, {
      overall,
      checkCount: Object.keys(checkResults).length,
      duration: totalTime,
    });

    // Check alerts
    await this.processAlerts(systemHealth);

    return systemHealth;
  }

  private async processAlerts(health: SystemHealth): Promise<void> {
    const now = new Date();
    
    for (const [ruleName, rule] of this.alertRules.entries()) {
      try {
        // Check cooldown
        const lastAlert = this.lastAlerts.get(ruleName);
        if (lastAlert) {
          const timeSinceLastAlert = (now.getTime() - lastAlert.getTime()) / (1000 * 60); // minutes
          if (timeSinceLastAlert < rule.cooldown) {
            continue;
          }
        }

        // Check condition
        if (rule.condition(health)) {
          await rule.action(health);
          this.lastAlerts.set(ruleName, now);
          
          log.warn(`Alert triggered: ${ruleName}`, {
            severity: rule.severity,
            health: health.overall,
          });
        }
      } catch (error) {
        log.error(`Alert rule execution failed: ${ruleName}`, error as Error);
      }
    }
  }

  startMonitoring(intervalMs?: number): void {
    if (this.isMonitoring) {
      log.warn('Health monitoring is already running');
      return;
    }

    const interval = intervalMs || this.checkInterval;
    this.isMonitoring = true;
    
    log.info('Starting health monitoring', { intervalMs: interval });
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        log.error('Health monitoring cycle failed', error as Error);
      }
    }, interval);
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    log.info('Health monitoring stopped');
  }

  getStatus(): {
    isMonitoring: boolean;
    checkCount: number;
    alertRuleCount: number;
    lastHealth?: SystemHealth;
  } {
    return {
      isMonitoring: this.isMonitoring,
      checkCount: this.checks.size,
      alertRuleCount: this.alertRules.size,
    };
  }

  cleanup(): void {
    this.stopMonitoring();
    this.checks.clear();
    this.alertRules.clear();
    this.lastAlerts.clear();
    log.info('Health monitor cleanup completed');
  }
}

// Singleton instance
let healthMonitorInstance: HealthMonitor | null = null;

export const getHealthMonitor = (): HealthMonitor => {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitor();
  }
  return healthMonitorInstance;
};

export { HealthMonitor };