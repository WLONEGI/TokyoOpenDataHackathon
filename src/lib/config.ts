import { AppConfig } from '@/types';

// API Key validation utility
const validateApiKey = (key: string | undefined, keyName: string): string => {
  if (!key || key.length === 0) {
    throw new Error(`${keyName} is required but not provided`);
  }
  
  // Check for dummy/placeholder values (更に厳格に)
  const invalidPatterns = [
    'your_key_here', 'placeholder', 'dummy', 'test_key', 'example',
    'sample', 'fake', 'mock', 'development', 'dev', 'localhost'
  ];
  if (invalidPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
    throw new Error(`${keyName} appears to be a placeholder value`);
  }
  
  // Enhanced format validation for Gemini API key
  if (keyName === 'GEMINI_API_KEY') {
    if (!key.startsWith('AIza')) {
      throw new Error(`${keyName} format is invalid (must start with 'AIza')`);
    }
    
    // Length validation (Gemini API keys are typically 39 characters)
    if (key.length < 30 || key.length > 50) {
      throw new Error(`${keyName} length is invalid (expected 30-50 characters)`);
    }
    
    // Character validation (should contain only alphanumeric and specific symbols)
    if (!/^[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error(`${keyName} contains invalid characters`);
    }
  }
  
  // Environment-specific validation
  if (process.env.NODE_ENV === 'production') {
    // In production, ensure key doesn't contain development indicators
    const devIndicators = ['dev', 'test', 'local', 'staging'];
    if (devIndicators.some(indicator => key.toLowerCase().includes(indicator))) {
      throw new Error(`${keyName} appears to be a development key in production environment`);
    }
  }
  
  return key;
};

// Safe configuration loading with validation
const loadConfig = (): AppConfig => {
  try {
    const geminiApiKey = validateApiKey(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY');
    
    return {
      geminiApiKey,
      redisUrl: process.env.REDIS_URL,
      gcpProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      gcpRegion: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
      enableVoice: process.env.NEXT_PUBLIC_ENABLE_VOICE === 'true',
      enableMultiLanguage: process.env.NEXT_PUBLIC_ENABLE_MULTILANG === 'true',
      maxSessionDuration: Math.max(60000, parseInt(process.env.NEXT_PUBLIC_MAX_SESSION_DURATION || '3600000')), // min 1 minute
      maxMessagesPerSession: Math.max(1, parseInt(process.env.NEXT_PUBLIC_MAX_MESSAGES_PER_SESSION || '50')), // min 1 message
      enableDynamicSearch: process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_SEARCH !== 'false', // デフォルト有効
      tokyoOpenDataCatalogUrl: process.env.TOKYO_OPEN_DATA_CATALOG_URL || 'https://catalog.data.metro.tokyo.lg.jp',
      maxConcurrentDatasetRequests: Math.max(1, parseInt(process.env.MAX_CONCURRENT_DATASET_REQUESTS || '5')),
    };
  } catch (error) {
    console.error('Configuration validation failed:', error);
    throw error;
  }
};

export const config: AppConfig = loadConfig();

export const validateConfig = (): void => {
  const requiredKeys = ['geminiApiKey'];
  const missingKeys = requiredKeys.filter(key => !config[key as keyof AppConfig]);
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing required configuration: ${missingKeys.join(', ')}`);
  }
  
  // Additional runtime validation
  if (config.maxSessionDuration < 60000) {
    throw new Error('maxSessionDuration must be at least 60 seconds');
  }
  
  if (config.maxMessagesPerSession < 1) {
    throw new Error('maxMessagesPerSession must be at least 1');
  }
  
  // Security validation
  if (process.env.NODE_ENV === 'production') {
    // Ensure sensitive config is not logged in production
    if (config.geminiApiKey.length < 30) {
      throw new Error('API key appears to be too short for production use');
    }
    
    // Validate Redis URL in production if provided
    if (config.redisUrl && !config.redisUrl.startsWith('redis://') && !config.redisUrl.startsWith('rediss://')) {
      throw new Error('Invalid Redis URL format in production');
    }
  }
  
  console.log('✅ Configuration validation passed');
};

// Secure configuration getter - never logs sensitive values
export const getSecureConfig = () => {
  return {
    ...config,
    geminiApiKey: config.geminiApiKey ? '[REDACTED]' : 'NOT_SET',
    redisUrl: config.redisUrl ? '[REDACTED]' : 'NOT_SET',
  };
};

export const getApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  
  // Validate URL format
  try {
    new URL(baseUrl);
    return baseUrl;
  } catch {
    console.warn(`Invalid API base URL: ${baseUrl}, falling back to localhost`);
    return 'http://localhost:3000';
  }
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

// Security configuration
export const securityConfig = {
  // Rate limiting
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: isProduction() ? 100 : 1000, // Production: 100/15min, Dev: 1000/15min
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  
  // Input validation
  validation: {
    maxMessageLength: 2000,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedAudioTypes: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/m4a'],
  },
  
  // Session security
  session: {
    maxAge: config.maxSessionDuration,
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict' as const,
  },
};