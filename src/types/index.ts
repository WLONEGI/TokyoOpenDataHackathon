// Chat types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  language: 'ja' | 'en' | 'zh' | 'ko';
}

// API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface VoiceRequest {
  audioData: string;
  mimeType: string;
  sessionId: string;
  language?: string;
}

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  language?: string;
  useVoice?: boolean;
}

export interface ChatResponse {
  response: string;
  audioUrl?: string;
  sources?: DataSource[];
}

// Data source types
export interface DataSource {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  lastUpdated: Date;
}

export interface OpenDataItem {
  id: string;
  title: string;
  description: string;
  category: 'childcare' | 'disaster' | 'medical' | 'education' | 'general';
  tags: string[];
  content: string;
  embeddings?: number[];
  metadata: {
    source: string;
    lastUpdated: Date;
    language: string;
  };
}

// Search types
export interface SearchQuery {
  text: string;
  category?: string;
  language?: string;
  limit?: number;
}

export interface SearchResult {
  items: OpenDataItem[];
  total: number;
  query: string;
}

// Session types
export interface SessionData {
  id: string;
  language: 'ja' | 'en' | 'zh' | 'ko';
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
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
}