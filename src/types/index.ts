// Language types
export type SupportedLanguage = 'ja' | 'en' | 'zh' | 'ko';
export type MessageRole = 'user' | 'assistant';
export type OpenDataCategory = 'childcare' | 'disaster' | 'medical' | 'education' | 'general' | 
  'environment' | 'transportation' | 'economy' | 'tourism' | 'welfare' | 'housing' | 'statistics' | 
  'government' | 'safety' | 'culture' | 'sports' | 'technology' | 'urban-planning';

// Chat types
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface MessageMetadata {
  sources?: DataSource[];
  confidence?: number;
  processingTime?: number;
  errorCode?: string;
  retryCount?: number;
  status?: MessageStatus;
  // 拡張メタデータ
  inputType?: 'text' | 'voice';
  language?: SupportedLanguage;
  clientIP?: string;
  hasLocation?: boolean;
  requestedScope?: {
    timeRange?: 'today' | 'this_week' | 'this_month' | 'next_month' | 'any';
    locationRange?: 'nearby' | 'walking_distance' | 'cycling_distance' | 'city_wide' | 'any';
  };
  // AI応答メタデータ
  reasoning?: {
    approach: string;
    keyInsights: string[];
    evidenceSummary: string;
  };
  recommendations?: string[];
  uncertaintyIndicators?: string[];
  followUpQuestions?: string[];
  relatedTopics?: string[];
  processingMetrics?: {
    processingTime: number;
    toolsUsed: string[];
    dataSourcesAccessed: string[];
    qualityScore: number;
  };
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  audioUrl?: string;
  metadata?: MessageMetadata;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  language: SupportedLanguage;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  };
}

// API types
export interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  retryable?: boolean;
}

export interface VoiceRequest {
  audioData: string;
  mimeType: 'audio/webm' | 'audio/mp3' | 'audio/wav' | 'audio/m4a';
  sessionId: string;
  language?: SupportedLanguage;
  fileSize?: number;
}

export interface VoiceResponse {
  text?: string;
  transcribedText?: string;
  audioUrl?: string;
  confidence?: number;
  timestamp?: Date;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  language?: SupportedLanguage;
  useVoice?: boolean;
  inputType?: 'text' | 'voice';
  // コンテキスト情報
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
  };
  requestedScope?: {
    timeRange?: 'today' | 'this_week' | 'this_month' | 'next_month' | 'any';
    locationRange?: 'nearby' | 'walking_distance' | 'cycling_distance' | 'city_wide' | 'any';
  };
}

export interface ChatResponse {
  response: string;
  audioUrl?: string;
  sources?: DataSource[];
  shouldPlayAudio?: boolean;
  confidence?: number;
  metadata?: {
    processingTime?: number;
    sourceCount?: number;
  };
}

// Data source types
export interface DataSource {
  id: string;
  title: string;
  url?: string;
  description: string;
  category: string;
  lastUpdated: Date;
}

export interface OpenDataMetadata {
  source: string;
  lastUpdated: Date;
  language: SupportedLanguage;
  dataFormat?: 'csv' | 'json' | 'xml' | 'xlsx' | 'pdf' | 'txt' | 'geojson';
  version?: string;
  author?: string;
  datasetId?: string;
  resourceId?: string;
  organization?: string;
  license?: string;
  downloadUrl?: string;
  fileSize?: number;
}

export interface OpenDataItem {
  id: string;
  title: string;
  description: string;
  category: OpenDataCategory;
  tags: string[];
  content: string;
  embeddings?: number[];
  metadata: OpenDataMetadata;
}

// Search types
export interface SearchQuery {
  text: string;
  category?: OpenDataCategory;
  language?: SupportedLanguage;
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  minConfidence?: number;
}

export interface SearchResult {
  items: OpenDataItem[];
  total: number;
  query: string;
  processingTime?: number;
  usedCache?: boolean;
  searchMethod?: 'dynamic' | 'vertex' | 'local' | 'fallback';
}

// Session types
export interface SessionData {
  id: string;
  language: SupportedLanguage;
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
  isActive: boolean;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  };
}

// Error types
export interface ErrorDetails {
  timestamp: Date;
  requestId?: string;
  userId?: string;
  context?: Record<string, string | number | boolean>;
}

export interface AppErrorInterface {
  code: string;
  message: string;
  statusCode: number;
  isRetryable: boolean;
  details?: ErrorDetails;
}

// Configuration types
export interface AppConfig {
  geminiApiKey: string;
  redisUrl?: string;
  gcpProjectId?: string;
  gcpRegion?: string;
  enableVoice: boolean;
  enableMultiLanguage: boolean;
  maxSessionDuration: number;
  maxMessagesPerSession: number;
  enableDynamicSearch?: boolean;
  tokyoOpenDataCatalogUrl?: string;
  maxConcurrentDatasetRequests?: number;
}