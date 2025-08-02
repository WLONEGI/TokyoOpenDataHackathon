// 基本型定義
export type Language = 'ja' | 'en';

export type MessageType = 'user' | 'assistant';

export type ResponseLength = 'short' | 'normal' | 'detailed';

// API関連型定義
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}

// セッション関連型定義
export interface Session {
  id: string;
  userId?: string;
  language: Language;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  voiceEnabled: boolean;
  language: Language;
  responseLength: ResponseLength;
}

// メッセージ関連型定義
export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: string;
  audioUrl?: string;
  metadata?: {
    sources?: DataSource[];
    confidence?: number;
    processingTime?: number;
    language?: Language;
  };
}

export interface DataSource {
  id: string;
  title: string;
  url?: string;
  category: string;
  score: number;
}

// API リクエスト/レスポンス型定義
export interface ChatRequest {
  message: string;
  sessionId?: string;
  language?: Language;
  options?: {
    includeAudio?: boolean;
    responseLength?: ResponseLength;
  };
}

export interface ChatResponse {
  content: string;
  sessionId: string;
  audioUrl?: string;
  sources?: DataSource[];
  metadata: {
    processingTime: number;
    confidence: number;
    language: Language;
  };
}

export interface VoiceRecognitionRequest {
  audio: File;
  language?: Language;
  sessionId?: string;
}

export interface VoiceRecognitionResponse {
  transcript: string;
  confidence: number;
  language: Language;
  duration: number;
  metadata: {
    processingTime: number;
    audioFormat: string;
    sampleRate: number;
  };
}

export interface VoiceSynthesisRequest {
  text: string;
  language?: Language;
  voice?: {
    gender?: 'male' | 'female';
    speed?: number;
    pitch?: number;
  };
}

export interface VoiceSynthesisResponse {
  audioUrl: string;
  duration: number;
  text: string;
  metadata: {
    processingTime: number;
    audioFormat: string;
    fileSize: number;
    cacheHit: boolean;
  };
}

// 音声処理関連型定義
export interface AudioConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface VoiceActivityDetection {
  isSpeaking: boolean;
  confidence: number;
  timestamp: number;
}

// UI状態管理型定義
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
  sessionId: string | null;
}

export interface VoiceState {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  error: string | null;
  transcript: string;
  isPlaying: boolean;
}

export interface UIState {
  language: Language;
  isDarkMode: boolean;
  isSettingsOpen: boolean;
  activeMode: 'voice' | 'text';
}

// エラー関連型定義
export enum APIErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  MESSAGE_EMPTY = 'MESSAGE_EMPTY',
  CHAT_PROCESSING_ERROR = 'CHAT_PROCESSING_ERROR',
  VOICE_FILE_TOO_LARGE = 'VOICE_FILE_TOO_LARGE',
  VOICE_FORMAT_UNSUPPORTED = 'VOICE_FORMAT_UNSUPPORTED',
  VOICE_RECOGNITION_FAILED = 'VOICE_RECOGNITION_FAILED',
  VOICE_SYNTHESIS_FAILED = 'VOICE_SYNTHESIS_FAILED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  VECTOR_SEARCH_ERROR = 'VECTOR_SEARCH_ERROR'
}

export interface APIError {
  code: APIErrorCode;
  message: string;
  details?: any;
}

// 多言語対応関連型定義
export interface LocalizedText {
  ja: string;
  en: string;
}

export interface Translation {
  [key: string]: string | Translation;
}

// コンポーネントプロパティ型定義
export interface ChatInterfaceProps {
  className?: string;
  onMessageSent?: (message: ChatMessage) => void;
}

export interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onTranscript?: (transcript: string) => void;
  isEnabled?: boolean;
  className?: string;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  onAudioPlay?: () => void;
  className?: string;
}

// 設定関連型定義
export interface AppSettings {
  language: Language;
  voiceSettings: {
    enabled: boolean;
    autoPlay: boolean;
    speed: number;
    volume: number;
  };
  chatSettings: {
    responseLength: ResponseLength;
    showSources: boolean;
    animateMessages: boolean;
  };
  accessibilitySettings: {
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
  };
}

// パフォーマンス監視型定義
export interface PerformanceMetrics {
  responseTime: number;
  audioProcessingTime: number;
  renderTime: number;
  memoryUsage: number;
  timestamp: number;
}

// 検索関連型定義
export interface SearchQuery {
  text: string;
  language: Language;
  category?: string;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  url?: string;
  score: number;
  metadata: {
    source: string;
    lastUpdated: string;
    tags: string[];
  };
}

// ヘルスチェック型定義
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    redis: ServiceHealth;
    gemini: ServiceHealth;
    vectorSearch: ServiceHealth;
    cloudStorage: ServiceHealth;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    activeConnections: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: string;
  error?: string;
}