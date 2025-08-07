// Service Manager for singleton pattern and memory management
import { GeminiService } from './GeminiService';
import { VectorSearchService } from './VectorSearchService';
import { OpenDataService } from './OpenDataService';

// Union type for all supported services
type SupportedService = GeminiService | VectorSearchService | OpenDataService;

export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, SupportedService> = new Map();
  private initialized: Set<string> = new Set();
  private lastAccess: Map<string, number> = new Map();
  
  // Cleanup interval (30 minutes)
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000;
  private readonly MAX_IDLE_TIME = 60 * 60 * 1000; // 1 hour

  private constructor() {
    // Start cleanup process
    this.startCleanupProcess();
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  async getGeminiService(): Promise<GeminiService> {
    const serviceName = 'gemini';
    
    if (!this.services.has(serviceName)) {
      const service = new GeminiService();
      this.services.set(serviceName, service);
      this.initialized.add(serviceName);
    }
    
    this.updateLastAccess(serviceName);
    return this.services.get(serviceName) as GeminiService;
  }

  async getVectorSearchService(): Promise<VectorSearchService> {
    const serviceName = 'vectorSearch';
    
    if (!this.services.has(serviceName)) {
      const service = new VectorSearchService();
      this.services.set(serviceName, service);
      
      // Initialize index asynchronously (non-blocking)
      if (!this.initialized.has(serviceName)) {
        this.initializeVectorSearchAsync(service, serviceName);
      }
    }
    
    this.updateLastAccess(serviceName);
    return this.services.get(serviceName) as VectorSearchService;
  }

  private async initializeVectorSearchAsync(service: VectorSearchService, serviceName: string): Promise<void> {
    try {
      console.log('🔄 Starting vector search service initialization in background...');
      service.initializeIndex().then(() => {
        this.initialized.add(serviceName);
        console.log('✅ Vector search service initialized');
      }).catch((error) => {
        console.error('❌ Failed to initialize vector search service:', error);
        // Service will work without index
      });
    } catch (error) {
      console.error('❌ Error starting vector search initialization:', error);
    }
  }

  async getOpenDataService(): Promise<OpenDataService> {
    const serviceName = 'openData';
    
    if (!this.services.has(serviceName)) {
      const service = new OpenDataService();
      this.services.set(serviceName, service);
      this.initialized.add(serviceName);
    }
    
    this.updateLastAccess(serviceName);
    return this.services.get(serviceName) as OpenDataService;
  }

  private updateLastAccess(serviceName: string): void {
    this.lastAccess.set(serviceName, Date.now());
  }

  private startCleanupProcess(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleServices();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupIdleServices(): void {
    const now = Date.now();
    const servicesToRemove: string[] = [];
    
    for (const [serviceName, lastAccess] of this.lastAccess.entries()) {
      if (now - lastAccess > this.MAX_IDLE_TIME) {
        servicesToRemove.push(serviceName);
      }
    }
    
    for (const serviceName of servicesToRemove) {
      const service = this.services.get(serviceName);
      
      // Call cleanup method if exists
      if (service && 'cleanup' in service && typeof service.cleanup === 'function') {
        try {
          service.cleanup();
        } catch (error) {
          console.error(`Error cleaning up service ${serviceName}:`, error);
        }
      }
      
      this.services.delete(serviceName);
      this.initialized.delete(serviceName);
      this.lastAccess.delete(serviceName);
      
      console.log(`🧹 Cleaned up idle service: ${serviceName}`);
    }
  }

  // Manual cleanup method
  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Cleanup all services
    for (const [serviceName, service] of this.services.entries()) {
      if (service && 'cleanup' in service && typeof service.cleanup === 'function') {
        try {
          service.cleanup();
        } catch (error) {
          console.error(`Error cleaning up service ${serviceName}:`, error);
        }
      }
    }
    
    this.services.clear();
    this.initialized.clear();
    this.lastAccess.clear();
    
    console.log('🧹 ServiceManager cleanup completed');
  }

  // Get service statistics
  public getStats(): {
    activeServices: number;
    initializedServices: string[];
    lastAccessTimes: Record<string, string>;
  } {
    const stats = {
      activeServices: this.services.size,
      initializedServices: Array.from(this.initialized),
      lastAccessTimes: {} as Record<string, string>,
    };
    
    for (const [serviceName, timestamp] of this.lastAccess.entries()) {
      stats.lastAccessTimes[serviceName] = new Date(timestamp).toISOString();
    }
    
    return stats;
  }

  // Force service reinitialization
  public async reinitializeService(serviceName: string): Promise<void> {
    if (this.services.has(serviceName)) {
      const service = this.services.get(serviceName);
      if (service && 'cleanup' in service && typeof service.cleanup === 'function') {
        service.cleanup();
      }
      this.services.delete(serviceName);
      this.initialized.delete(serviceName);
      this.lastAccess.delete(serviceName);
    }
    
    // Reinitialize based on service name (type-safe)
    switch (serviceName) {
      case 'gemini':
        await this.getGeminiService();
        break;
      case 'vectorSearch':
        await this.getVectorSearchService();
        break;
      case 'openData':
        await this.getOpenDataService();
        break;
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
    
    console.log(`🔄 Service ${serviceName} reinitialized`);
  }
}

// Global cleanup handler for graceful shutdown
if (typeof process !== 'undefined') {
  const cleanup = () => {
    const manager = ServiceManager.getInstance();
    manager.cleanup();
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}