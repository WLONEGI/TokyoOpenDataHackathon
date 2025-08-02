import { AppConfig } from '@/types';

export const config: AppConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  redisUrl: process.env.REDIS_URL,
  gcpProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  gcpRegion: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
  enableVoice: process.env.NEXT_PUBLIC_ENABLE_VOICE === 'true',
  enableMultiLanguage: process.env.NEXT_PUBLIC_ENABLE_MULTILANG === 'true',
  maxSessionDuration: parseInt(process.env.NEXT_PUBLIC_MAX_SESSION_DURATION || '3600000'),
  maxMessagesPerSession: parseInt(process.env.NEXT_PUBLIC_MAX_MESSAGES_PER_SESSION || '50'),
};

export const validateConfig = (): void => {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }
};

export const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};