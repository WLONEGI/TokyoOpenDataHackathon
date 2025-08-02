# 東京都公式アプリ AI音声対話機能
## API設計書（MVP版）

**文書情報**
- **文書名**: 東京都公式アプリ AI音声対話機能 API設計書（MVP版）
- **版数**: 1.0
- **作成日**: 2025年1月
- **作成者**: 根岸祐樹
- **備考**: MVP機能に限定したAPI設計書

---

## 1. API概要

### 1.1 アーキテクチャ概要

```mermaid
graph TB
    subgraph "Client"
        UI[Web UI]
    end
    
    subgraph "Next.js Application"
        subgraph "API Routes"
            CHAT[/api/chat]
            VOICE[/api/voice/*]
            SESSION[/api/session]
            HEALTH[/api/health]
        end
        
        subgraph "Services"
            CS[ChatService]
            VS[VoiceService]
            SS[SessionService]
            DS[DataService]
        end
        
        subgraph "External APIs"
            GA[Gemini API]
            VVS[Vertex Vector Search]
            GCS[Cloud Storage]
        end
    end
    
    UI --> CHAT
    UI --> VOICE
    UI --> SESSION
    
    CHAT --> CS
    VOICE --> VS
    SESSION --> SS
    
    CS --> SS
    CS --> DS
    VS --> GA
    DS --> VVS
    DS --> GCS
```

### 1.2 API設計原則

#### 1.2.1 基本原則
- **RESTful設計**: HTTP動詞とリソース指向
- **JSON通信**: リクエスト・レスポンスともにJSON形式
- **ステートレス**: セッションIDによる状態管理
- **エラーハンドリング**: 統一されたエラーレスポンス形式
- **レート制限**: 悪用防止のための制限実装

#### 1.2.2 セキュリティ原則
- **HTTPS必須**: 全ての通信でHTTPS使用
- **入力検証**: 全てのパラメータに対する検証
- **出力エスケープ**: XSS攻撃防止
- **レート制限**: DDoS攻撃防止

#### 1.2.3 パフォーマンス原則
- **キャッシュ活用**: 適切なキャッシュヘッダー設定
- **圧縮**: レスポンスデータの圧縮
- **最小限のデータ**: 必要最小限のデータ転送

---

## 2. 共通仕様

### 2.1 リクエスト・レスポンス形式

#### 2.1.1 リクエストヘッダー

```http
POST /api/chat HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Accept: application/json
Accept-Language: ja,en;q=0.9
User-Agent: Mozilla/5.0 (...)
X-Session-ID: abc123-def456-ghi789
```

#### 2.1.2 レスポンス形式

**成功レスポンス**:
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId: string;
}
```

**エラーレスポンス**:
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}
```

### 2.2 共通パラメータ

#### 2.2.1 言語パラメータ
```typescript
type Language = 'ja' | 'en';
```

#### 2.2.2 セッションID
```typescript
type SessionId = string; // UUID v4 format
```

### 2.3 エラーコード定義

```typescript
enum APIErrorCode {
  // 共通エラー
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', 
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  
  // セッション関連
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  
  // チャット関連
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  MESSAGE_EMPTY = 'MESSAGE_EMPTY',
  CHAT_PROCESSING_ERROR = 'CHAT_PROCESSING_ERROR',
  
  // 音声関連
  VOICE_FILE_TOO_LARGE = 'VOICE_FILE_TOO_LARGE',
  VOICE_FORMAT_UNSUPPORTED = 'VOICE_FORMAT_UNSUPPORTED',
  VOICE_RECOGNITION_FAILED = 'VOICE_RECOGNITION_FAILED',
  VOICE_SYNTHESIS_FAILED = 'VOICE_SYNTHESIS_FAILED',
  
  // 外部サービス
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  VECTOR_SEARCH_ERROR = 'VECTOR_SEARCH_ERROR'
}
```

---

## 3. チャットAPI

### 3.1 メッセージ送信API

#### 3.1.1 エンドポイント
```
POST /api/chat
```

#### 3.1.2 リクエスト仕様

**リクエストボディ**:
```typescript
interface ChatRequest {
  message: string;           // 1-1000文字
  sessionId?: string;        // オプション（新規の場合）
  language?: Language;       // デフォルト: 'ja'
  options?: {
    includeAudio?: boolean;  // 音声レスポンス生成
    responseLength?: 'short' | 'normal' | 'detailed';
  };
}
```

**バリデーションルール**:
- `message`: 必須、1-1000文字、空白のみ不可
- `sessionId`: オプション、UUID v4形式
- `language`: オプション、'ja' または 'en'

**リクエスト例**:
```json
{
  "message": "近くの保育園を教えてください",
  "sessionId": "abc123-def456-ghi789",
  "language": "ja",
  "options": {
    "includeAudio": true,
    "responseLength": "normal"
  }
}
```

#### 3.1.3 レスポンス仕様

**レスポンスボディ**:
```typescript
interface ChatResponse {
  content: string;           // AI応答テキスト
  sessionId: string;         // セッションID
  audioUrl?: string;         // 音声ファイルURL（音声生成時）
  sources?: DataSource[];    // 参照データソース
  metadata: {
    processingTime: number;  // 処理時間（ms）
    confidence: number;      // 信頼度 (0-1)
    language: Language;      // 応答言語
  };
}

interface DataSource {
  id: string;
  title: string;
  url?: string;
  category: string;
  score: number;             // 関連度スコア
}
```

**成功レスポンス例**:
```json
{
  "success": true,
  "data": {
    "content": "お近くの保育園についてご案内いたします。現在地の情報がございませんが、東京都内には以下のような保育園がございます...",
    "sessionId": "abc123-def456-ghi789",
    "audioUrl": "/api/audio/temp/abc123/output-20250115100535.mp3",
    "sources": [
      {
        "id": "childcare_001",
        "title": "認可保育園一覧",
        "url": "https://www.metro.tokyo.lg.jp/...",
        "category": "保育サービス",
        "score": 0.89
      }
    ],
    "metadata": {
      "processingTime": 2150,
      "confidence": 0.92,
      "language": "ja"
    }
  },
  "timestamp": "2025-01-15T10:05:35.123Z",
  "requestId": "req_abc123def456"
}
```

#### 3.1.4 エラーレスポンス

**バリデーションエラー例**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "メッセージが長すぎます",
    "details": {
      "field": "message",
      "maxLength": 1000,
      "actualLength": 1250
    }
  },
  "timestamp": "2025-01-15T10:05:35.123Z",
  "requestId": "req_abc123def456"
}
```

### 3.2 チャット履歴取得API

#### 3.2.1 エンドポイント
```
GET /api/chat/history?sessionId={sessionId}&limit={limit}&offset={offset}
```

#### 3.2.2 リクエスト仕様

**クエリパラメータ**:
```typescript
interface ChatHistoryParams {
  sessionId: string;         // 必須
  limit?: number;            // 1-50、デフォルト: 20
  offset?: number;           // 0以上、デフォルト: 0
}
```

#### 3.2.3 レスポンス仕様

```typescript
interface ChatHistoryResponse {
  messages: ChatMessage[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioUrl?: string;
  metadata?: {
    sources?: DataSource[];
    confidence?: number;
  };
}
```

---

## 4. 音声API

### 4.1 音声認識API

#### 4.1.1 エンドポイント
```
POST /api/voice/recognize
```

#### 4.1.2 リクエスト仕様

**Content-Type**: `multipart/form-data`

**フォームデータ**:
```typescript
interface VoiceRecognitionRequest {
  audio: File;               // 音声ファイル
  language?: Language;       // デフォルト: 'ja'
  sessionId?: string;        // セッションID
}
```

**ファイル制限**:
- **形式**: webm, mp3, wav, m4a
- **サイズ**: 最大 10MB
- **長さ**: 最大 60秒
- **サンプルレート**: 16kHz推奨

**リクエスト例**:
```javascript
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');
formData.append('language', 'ja');
formData.append('sessionId', 'abc123-def456-ghi789');

fetch('/api/voice/recognize', {
  method: 'POST',
  body: formData
});
```

#### 4.1.3 レスポンス仕様

```typescript
interface VoiceRecognitionResponse {
  transcript: string;        // 認識結果テキスト
  confidence: number;        // 信頼度 (0-1)
  language: Language;        // 認識言語
  duration: number;          // 音声長さ（秒）
  metadata: {
    processingTime: number;  // 処理時間（ms）
    audioFormat: string;     // 音声形式
    sampleRate: number;      // サンプルレート
  };
}
```

**成功レスポンス例**:
```json
{
  "success": true,
  "data": {
    "transcript": "近くの保育園を教えてください",
    "confidence": 0.94,
    "language": "ja",
    "duration": 3.2,
    "metadata": {
      "processingTime": 850,
      "audioFormat": "webm",
      "sampleRate": 48000
    }
  },
  "timestamp": "2025-01-15T10:05:32.456Z",
  "requestId": "req_voice123"
}
```

### 4.2 音声合成API

#### 4.2.1 エンドポイント
```
POST /api/voice/synthesize
```

#### 4.2.2 リクエスト仕様

```typescript
interface VoiceSynthesisRequest {
  text: string;              // 1-500文字
  language?: Language;       // デフォルト: 'ja'
  voice?: {
    gender?: 'male' | 'female';
    speed?: number;          // 0.5-2.0、デフォルト: 1.0
    pitch?: number;          // 0.5-2.0、デフォルト: 1.0
  };
}
```

**リクエスト例**:
```json
{
  "text": "お近くの保育園についてご案内いたします",
  "language": "ja",
  "voice": {
    "gender": "female",
    "speed": 1.0,
    "pitch": 1.0
  }
}
```

#### 4.2.3 レスポンス仕様

```typescript
interface VoiceSynthesisResponse {
  audioUrl: string;          // 音声ファイルURL
  duration: number;          // 音声長さ（秒）
  text: string;              // 元のテキスト
  metadata: {
    processingTime: number;  // 処理時間（ms）
    audioFormat: string;     // 'mp3'
    fileSize: number;        // ファイルサイズ（bytes）
    cacheHit: boolean;       // キャッシュヒット
  };
}
```

### 4.3 音声ファイル配信API

#### 4.3.1 エンドポイント
```
GET /api/audio/{type}/{sessionId}/{filename}
```

**パスパラメータ**:
- `type`: 'temp' | 'cache'
- `sessionId`: セッションID
- `filename`: ファイル名

#### 4.3.2 レスポンス仕様

**Content-Type**: `audio/mpeg` または `audio/webm`

**レスポンスヘッダー**:
```http
Content-Type: audio/mpeg
Content-Length: 45678
Content-Disposition: inline; filename="output-20250115100535.mp3"
Cache-Control: private, max-age=3600
```

---

## 5. セッション管理API

### 5.1 セッション作成API

#### 5.1.1 エンドポイント
```
POST /api/session
```

#### 5.1.2 リクエスト仕様

```typescript
interface SessionCreateRequest {
  language?: Language;       // デフォルト: 'ja'
  preferences?: {
    voiceEnabled?: boolean;  // デフォルト: true
    responseLength?: 'short' | 'normal' | 'detailed';
  };
}
```

#### 5.1.3 レスポンス仕様

```typescript
interface SessionCreateResponse {
  sessionId: string;
  language: Language;
  expiresAt: string;         // ISO 8601形式
  preferences: UserPreferences;
}
```

### 5.2 セッション取得API

#### 5.2.1 エンドポイント
```
GET /api/session/{sessionId}
```

#### 5.2.2 レスポンス仕様

```typescript
interface SessionGetResponse {
  sessionId: string;
  language: Language;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  messageCount: number;
  preferences: UserPreferences;
}
```

### 5.3 セッション削除API

#### 5.3.1 エンドポイント
```
DELETE /api/session/{sessionId}
```

#### 5.3.2 レスポンス仕様

```typescript
interface SessionDeleteResponse {
  sessionId: string;
  deletedAt: string;
}
```

---

## 6. ヘルスチェックAPI

### 6.1 システムヘルス

#### 6.1.1 エンドポイント
```
GET /api/health
```

#### 6.1.2 レスポンス仕様

```typescript
interface HealthCheckResponse {
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
    uptime: number;          // 稼働時間（秒）
    memoryUsage: number;     // メモリ使用率 (0-1)
    activeConnections: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;      // レスポンス時間（ms）
  lastCheck: string;
  error?: string;
}
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-15T10:05:35.123Z",
    "version": "1.0.0",
    "services": {
      "redis": {
        "status": "healthy",
        "responseTime": 2,
        "lastCheck": "2025-01-15T10:05:35.120Z"
      },
      "gemini": {
        "status": "healthy",
        "responseTime": 450,
        "lastCheck": "2025-01-15T10:05:35.115Z"
      },
      "vectorSearch": {
        "status": "healthy",
        "responseTime": 120,
        "lastCheck": "2025-01-15T10:05:35.118Z"
      },
      "cloudStorage": {
        "status": "healthy",
        "responseTime": 89,
        "lastCheck": "2025-01-15T10:05:35.119Z"
      }
    },
    "metrics": {
      "uptime": 86400,
      "memoryUsage": 0.65,
      "activeConnections": 42
    }
  },
  "timestamp": "2025-01-15T10:05:35.123Z",
  "requestId": "req_health123"
}
```

---

## 7. レート制限

### 7.1 制限設定

| エンドポイント | 制限 | ウィンドウ | 制限種別 |
|----------------|------|------------|----------|
| `/api/chat` | 60回 | 1分 | セッション単位 |
| `/api/voice/recognize` | 30回 | 1分 | セッション単位 |
| `/api/voice/synthesize` | 100回 | 1分 | セッション単位 |
| `/api/session` | 10回 | 1分 | IP単位 |

### 7.2 制限レスポンス

**レート制限エラー**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "リクエスト回数の上限を超えました",
    "details": {
      "limit": 60,
      "window": 60,
      "retryAfter": 45
    }
  },
  "timestamp": "2025-01-15T10:05:35.123Z",
  "requestId": "req_limit123"
}
```

**レスポンスヘッダー**:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642248375
Retry-After: 45
```

---

## 8. 認証・認可

### 8.1 MVP版認証方針

MVP版では簡素化された認証を実装：
- **セッションベース認証**: ユーザー認証なし
- **API Key認証**: 外部サービス向け（将来拡張）
- **CORS設定**: 東京都ドメインからのアクセスのみ許可

### 8.2 セッション認証

```typescript
// セッション検証ミドルウェア
export async function validateSession(
  sessionId: string
): Promise<Session | null> {
  if (!sessionId || !isValidUUID(sessionId)) {
    return null;
  }
  
  const session = await sessionService.getSession(sessionId);
  
  if (!session) {
    return null;
  }
  
  // セッション有効期限チェック
  if (new Date() > new Date(session.expiresAt)) {
    await sessionService.deleteSession(sessionId);
    return null;
  }
  
  return session;
}
```

---

## 9. API実装例

### 9.1 チャットAPI実装

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ChatService } from '@/services/ChatService';
import { validateChatRequest } from '@/lib/validation';
import { withErrorHandler } from '@/lib/middleware';

export const POST = withErrorHandler(async (req: NextRequest) => {
  // 1. リクエストボディ解析
  const body = await req.json();
  
  // 2. バリデーション
  const validation = validateChatRequest(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
          details: validation.details
        },
        timestamp: new Date().toISOString(),
        requestId: generateRequestId()
      },
      { status: 400 }
    );
  }
  
  // 3. レート制限チェック
  const sessionId = body.sessionId || await createNewSession();
  await checkRateLimit(sessionId, 'chat');
  
  // 4. チャット処理
  const chatService = new ChatService();
  const response = await chatService.processMessage(
    sessionId,
    body.message,
    body.language || 'ja',
    body.options
  );
  
  // 5. レスポンス返却
  return NextResponse.json({
    success: true,
    data: response,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  });
});

// バリデーション関数
function validateChatRequest(body: any): ValidationResult {
  const errors: string[] = [];
  
  if (!body.message) {
    errors.push('Message is required');
  } else if (typeof body.message !== 'string') {
    errors.push('Message must be a string');
  } else if (body.message.length > 1000) {
    errors.push('Message is too long');
  } else if (body.message.trim().length === 0) {
    errors.push('Message cannot be empty');
  }
  
  if (body.sessionId && !isValidUUID(body.sessionId)) {
    errors.push('Invalid session ID format');
  }
  
  if (body.language && !['ja', 'en'].includes(body.language)) {
    errors.push('Unsupported language');
  }
  
  return {
    success: errors.length === 0,
    error: errors.join(', '),
    details: errors
  };
}
```

### 9.2 音声認識API実装

```typescript
// app/api/voice/recognize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { VoiceService } from '@/services/VoiceService';
import { withErrorHandler } from '@/lib/middleware';

export const POST = withErrorHandler(async (req: NextRequest) => {
  // 1. FormData解析
  const formData = await req.formData();
  const audioFile = formData.get('audio') as File;
  const language = formData.get('language') as string || 'ja';
  const sessionId = formData.get('sessionId') as string;
  
  // 2. ファイルバリデーション
  if (!audioFile) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Audio file is required'
        },
        timestamp: new Date().toISOString(),
        requestId: generateRequestId()
      },
      { status: 400 }
    );
  }
  
  // ファイルサイズチェック（10MB）
  if (audioFile.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VOICE_FILE_TOO_LARGE',
          message: 'Audio file is too large'
        },
        timestamp: new Date().toISOString(),
        requestId: generateRequestId()
      },
      { status: 413 }
    );
  }
  
  // 3. レート制限チェック
  await checkRateLimit(sessionId, 'voice_recognize');
  
  // 4. 音声認識処理
  const voiceService = new VoiceService();
  const audioBuffer = await audioFile.arrayBuffer();
  
  const result = await voiceService.recognizeSpeech(
    Buffer.from(audioBuffer),
    language as Language
  );
  
  // 5. レスポンス返却
  return NextResponse.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  });
});
```

---

## 10. 監視・ログ

### 10.1 APIログ仕様

#### 10.1.1 アクセスログ

```json
{
  "timestamp": "2025-01-15T10:05:35.123Z",
  "level": "info",
  "type": "api_access",
  "requestId": "req_abc123def456",
  "method": "POST",
  "path": "/api/chat",
  "sessionId": "abc123-def456-ghi789",
  "userAgent": "Mozilla/5.0 ...",
  "ip": "192.168.1.100",
  "responseTime": 2150,
  "statusCode": 200,
  "requestSize": 256,
  "responseSize": 1024
}
```

#### 10.1.2 エラーログ

```json
{
  "timestamp": "2025-01-15T10:05:35.123Z",
  "level": "error",
  "type": "api_error",
  "requestId": "req_abc123def456",
  "error": {
    "code": "GEMINI_API_ERROR",
    "message": "External API request failed",
    "stack": "Error: ...",
    "context": {
      "sessionId": "abc123-def456-ghi789",
      "endpoint": "/api/chat",
      "retryCount": 2
    }
  }
}
```

### 10.2 メトリクス

```typescript
interface APIMetrics {
  // リクエスト関連
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  
  // エンドポイント別
  endpointStats: {
    [endpoint: string]: {
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
    };
  };
  
  // 外部サービス
  externalServiceStats: {
    gemini: {
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
    };
    vectorSearch: {
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
    };
  };
}
```

このAPI設計書では、MVP版で必要な全てのエンドポイントを詳細に定義しました。次に、セキュリティ設計書の作成に進みます。