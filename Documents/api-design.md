# 東京都公式アプリ AI音声対話機能
## API設計書（実装版）

**文書情報**
- **文書名**: 東京都公式アプリ AI音声対話機能 API設計書（実装版）
- **版数**: 2.0
- **作成日**: 2025年1月
- **作成者**: 根岸祐樹
- **備考**: 実装完了版API設計書

---

## 改訂履歴

| 版数 | 改訂日 | 改訂者 | 改訂内容 |
|------|--------|--------|----------|
| 1.0 | 2025-01-15 | 根岸祐樹 | 初版作成（MVP機能API設計） |
| 2.0 | 2025-01-15 | 根岸祐樹 | 実装反映・高度AI機能API追加・検索API新規追加・レート制限更新 |

---

## 目次

1. [API概要](#1-api概要)
   - 1.1 [アーキテクチャ概要](#11-アーキテクチャ概要)
   - 1.2 [API設計原則](#12-api設計原則)
2. [共通仕様](#2-共通仕様)
   - 2.1 [リクエスト・レスポンス形式](#21-リクエストレスポンス形式)
   - 2.2 [共通パラメータ](#22-共通パラメータ)
   - 2.3 [エラーコード定義](#23-エラーコード定義)
3. [チャットAPI（実装版）](#3-チャットapi実装版)
   - 3.1 [メッセージ送信API](#31-メッセージ送信api)
   - 3.2 [チャット履歴取得API](#32-チャット履歴取得api)
4. [音声API（実装版）](#4-音声api実装版)
   - 4.1 [音声認識API](#41-音声認識api)
   - 4.2 [音声合成API（変更）](#42-音声合成api変更)
   - 4.3 [音声ファイル配信API](#43-音声ファイル配信api)
5. [セッション管理API](#5-セッション管理api)
   - 5.1 [セッション作成API](#51-セッション作成api)
   - 5.2 [セッション取得API](#52-セッション取得api)
   - 5.3 [セッション削除API](#53-セッション削除api)
6. [データAPI（実装版）](#6-データapi実装版)
   - 6.1 [動的データ検索API](#61-動的データ検索api)
   - 6.2 [カテゴリ別データ取得API](#62-カテゴリ別データ取得api)
   - 6.3 [テストAPI](#63-テストapi)
7. [検索API（新規実装）](#7-検索api新規実装)
   - 7.1 [統合検索API](#71-統合検索api)
8. [ヘルスチェックAPI（実装版）](#8-ヘルスチェックapi実装版)
   - 8.1 [システムヘルス](#81-システムヘルス)
9. [レート制限（実装版）](#9-レート制限実装版)
   - 9.1 [制限設定](#91-制限設定)
   - 9.2 [制限レスポンス](#92-制限レスポンス)
10. [認証・認可](#10-認証認可)
    - 10.1 [MVP版認証方針](#101-mvp版認証方針)
    - 10.2 [セッション認証](#102-セッション認証)
11. [API実装例](#11-api実装例)
    - 11.1 [チャットAPI実装](#111-チャットapi実装)
    - 11.2 [音声認識API実装](#112-音声認識api実装)
12. [監視・ログ](#12-監視ログ)
    - 12.1 [APIログ仕様](#121-apiログ仕様)
    - 12.2 [メトリクス](#122-メトリクス)

---

## 1. API概要

### 1.0 設計方針・根拠

**設計目標**：  
東京都公式アプリの音声対話機能における包括的なAPI設計により、市民への質の高い情報提供サービスを実現する。

**設計原則**：  
- **RESTful設計採用理由**: HTTPプロトコルの標準的な利用により、開発者にとって理解しやすく、メンテナンス性の高いAPIを実現
- **JSON通信選択理由**: 軽量でパース性能が高く、多言語対応が容易。フロントエンドとの親和性も良好
- **ステートレス設計理由**: スケーラビリティの確保と障害時の復旧性向上。セッションIDによる状態管理で必要最小限の状態保持
- **エラーハンドリング統一理由**: 一貫したエラーレスポンスにより、フロントエンド側でのエラー処理を簡素化

**技術選定根拠**：  
- **Next.js API Routes**: サーバーサイドレンダリングとAPIの統合により、開発効率と性能を両立
- **Gemini API**: 高精度な自然言語処理とマルチモーダル対応により、質の高い対話体験を実現
- **Redis**: 高速なセッション管理とキャッシュ機能により、レスポンス性能を向上
- **Vertex Vector Search**: 大規模データセットでの高精度な検索機能を実現

**要件対応方針**：  
- **アクセシビリティ**: 音声対話機能とマルチデバイス対応により、多様な利用環境に対応
- **パフォーマンス**: キャッシュ戦略とレート制限により、安定したサービス提供を実現
- **可用性**: ヘルスチェック機能とエラーハンドリングにより、高い可用性を確保
- **拡張性**: マイクロサービス的なAPI設計により、将来的な機能追加に柔軟に対応

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
- **RESTful設計**: HTTP動詞とリソース指向により、直感的で標準準拠したAPI設計
- **JSON通信**: リクエスト・レスポンスともにJSON形式で軽量性と可読性を確保
- **ステートレス**: セッションIDによる状態管理でスケーラビリティを実現
- **エラーハンドリング**: 統一されたエラーレスポンス形式でクライアント側の実装を簡素化
- **レート制限**: 悪用防止とサービス品質維持のための適切な制限実装

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

### 2.0 設計方針・根拠

**設計目標**：  
全APIエンドポイント間での一貫性を保ち、開発効率とメンテナンス性を向上させる。

**設計原則**：  
- **統一レスポンス形式**: 成功・エラー問わず一貫したレスポンス構造により、クライアント側の処理を統一化
- **包括的エラーコード**: システム内で発生する全てのエラー種別を網羅し、適切なエラーハンドリングを実現
- **多言語対応**: 日本語・英語対応により、多様な利用者のアクセシビリティを確保

**技術選定根拠**：  
- **TypeScriptインターフェース**: 型安全性の確保と開発時のエラー検出強化
- **UUID v4**: セッションIDの一意性と予測困難性を確保し、セキュリティを向上
- **ISO 8601タイムスタンプ**: 国際標準準拠により、タイムゾーン問題を回避

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

## 3. チャットAPI（全オープンデータ対応版）

### 3.0 設計方針・根拠

**設計目標**：  
東京都の9,742件のオープンデータセットを活用した高精度な質問応答システムを実現し、市民の情報アクセスを劇的に改善する。

**設計原則**：  
- **単一エンドポイント採用理由**: チャット機能の複雑性を隠蔽し、クライアント側の実装を簡素化
- **非同期処理設計**: 大規模データ検索とAI処理の並列実行により、レスポンス時間を最適化
- **コンテキスト保持**: セッション内での会話履歴を活用し、文脈を考慮した自然な対話を実現

**技術選定根拠**：  
- **Gemini API選択理由**: 高精度な自然言語理解とマルチモーダル対応により、複雑な質問に対する適切な回答を生成
- **動的検索統合**: リアルタイムでのオープンデータ検索により、常に最新情報を提供
- **ベクトル検索連携**: 意味的類似性に基づく高精度な情報検索を実現

**パフォーマンス要件対応**：  
- **キャッシュ戦略**: 検索結果とAI応答のキャッシュにより、同様質問への高速レスポンスを実現
- **並列処理**: 複数データソースの同時検索により、総処理時間を短縮
- **レート制限**: セッション単位15分100回の制限により、システム負荷を適切に管理

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
  inputType?: 'text' | 'voice';  // 入力タイプ（デフォルト: 'text'）
  useVoice?: boolean;        // 音声出力の使用可否
  searchScope?: 'dynamic' | 'childcare' | 'all'; // 検索範囲 ★NEW
  options?: {
    includeAudio?: boolean;  // 音声レスポンス生成（非推奨、useVoice使用）
    responseLength?: 'short' | 'normal' | 'detailed';
    enableDynamicSearch?: boolean; // 動的検索の有効/無効 ★NEW
    maxDatasets?: number;    // 検索対象データセット数上限 ★NEW
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
  "inputType": "text",
  "useVoice": false,
  "options": {
    "responseLength": "normal"
  }
}
```

#### 3.1.3 レスポンス仕様

**レスポンスボディ**:
```typescript
interface ChatResponse {
  response: string;          // AI応答テキスト
  sessionId?: string;        // セッションID（オプション）
  audioUrl?: string;         // 音声ファイルURL（音声生成時）
  sources?: DataSource[];    // 参照データソース
  shouldPlayAudio?: boolean; // 音声出力を行うかのフラグ
  searchInfo?: SearchInfo;   // 検索情報 ★NEW
  metadata?: {
    processingTime: number;  // 処理時間（ms）
    confidence: number;      // 信頼度 (0-1)
    language: Language;      // 応答言語
    searchMethod?: 'dynamic' | 'vertex' | 'local' | 'fallback'; // 使用された検索手法 ★NEW
  };
}

interface DataSource {
  id: string;
  title: string;
  url?: string;
  category: string;
  score: number;             // 関連度スコア
  datasetId?: string;        // データセットID ★NEW
  organization?: string;     // 提供組織 ★NEW
  lastUpdated?: string;      // 最終更新日 ★NEW
}

interface SearchInfo {
  totalDatasets: number;     // 検索対象データセット総数 ★NEW
  processedDatasets: number; // 実際に処理したデータセット数 ★NEW
  searchKeywords: string[];  // 抽出された検索キーワード ★NEW
  searchCategories: string[]; // 検索対象カテゴリ ★NEW
  cacheHit: boolean;         // キャッシュヒット ★NEW
}
```

**成功レスポンス例**:
```json
{
  "success": true,
  "data": {
    "response": "お近くの保育園についてご案内いたします。現在地の情報がございませんが、東京都内には以下のような保育園がございます...",
    "shouldPlayAudio": false,
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

### 4.0 設計方針・根拠

**設計目標**：  
アクセシビリティ向上を重視し、音声入力による情報アクセスを実現。視覚障害者や高齢者などの利用を促進する。

**設計原則**：  
- **Gemini API音声認識採用理由**: 高精度な日本語音声認識により、自然な音声対話を実現
- **Web Speech API音声合成選択理由**: ブラウザネイティブ機能の活用により、レスポンス速度向上とサーバー負荷軽減
- **複数音声形式対応**: webm、mp3、wav、m4aの対応により、多様なデバイス・ブラウザでの利用を可能にする

**技術選定根拠**：  
- **音声ファイル制限設定**: 10MB・60秒制限により、サーバーリソースを保護しつつ実用的な利用を確保
- **Base64エンコーディング**: セキュアな音声データ転送とブラウザ互換性を確保
- **セッション連携**: 音声認識結果の自動的なチャット処理により、シームレスな体験を提供

**アクセシビリティ要件対応**：  
- **多言語対応**: 日本語・英語の音声認識により、多様な利用者に対応
- **音声品質オプション**: 速度・ピッチ調整により、個人の聴覚特性に配慮
- **視覚的フィードバック**: 音声認識状態の視覚的表示により、聴覚障害者にも配慮

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
  audioData: string;         // Base64エンコードされた音声データ
  mimeType: string;          // 音声ファイルのMIMEタイプ
  language?: Language;       // デフォルト: 'ja'
  sessionId: string;         // セッションID（必須）
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
  response: string;          // AI応答テキスト
  sources?: DataSource[];    // 参照データソース
  shouldPlayAudio: boolean;  // 音声出力フラグ（常にtrue）
  text?: string;             // 認識結果テキスト（参考）
  metadata?: {
    processingTime: number;  // 処理時間（ms）
    confidence: number;      // 信頼度 (0-1)
    language: Language;      // 認識言語
  };
}
```

**成功レスポンス例**:
```json
{
  "success": true,
  "data": {
    "response": "お近くの保育園についてご案内いたします。現在地の情報がございませんが、東京都内には以下のような保育園がございます...",
    "shouldPlayAudio": true,
    "text": "近くの保育園を教えてください",
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
      "confidence": 0.94,
      "language": "ja"
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

### 5.0 設計方針・根拠

**設計目標**：  
会話コンテキストの維持と適切なリソース管理により、質の高い対話体験とシステムの安定性を両立する。

**設計原則**：  
- **Redis採用理由**: 高速なメモリベースストレージにより、セッション操作の高いレスポンス性能を実現
- **UUID v4セッションID**: 予測困難性とグローバル一意性により、セキュリティを確保
- **TTL機能活用**: 自動的なセッション有効期限管理により、メモリリソースの効率的な利用を実現

**技術選定根拠**：  
- **セッション単位の状態管理**: 個別の会話コンテキスト保持により、パーソナライズされた対話を提供
- **軽量なセッションデータ**: 必要最小限の情報のみ保存し、メモリ使用量を最適化
- **非永続化設計**: 個人情報保護と GDPR 準拠のため、セッション終了時の完全削除を実現

**セキュリティ要件対応**：  
- **セッション有効期限**: 24時間の自動有効期限により、放置されたセッションのセキュリティリスクを軽減
- **セッション検証**: 全API呼び出し時の有効性確認により、不正利用を防止
- **IP単位作成制限**: 1分10回の制限により、セッション作成の乱用を防止

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

## 6. データAPI（実装版） ★実装済み

### 6.0 設計方針・根拠

**設計目標**：  
東京都の全オープンデータ（9,742件）への統一的なアクセスインターフェースを提供し、市民の情報アクセス効率を劇的に向上させる。

**設計原則**：  
- **CKAN API統合選択理由**: 東京都公式のデータプラットフォームとの直接連携により、最新かつ正確な情報提供を保証
- **多形式データ処理**: CSV、XLS、JSON、PDF、GeoJSONの統一処理により、データ形式の違いを意識しない利用を実現
- **インテリジェント検索**: AI による関連性評価により、従来のキーワード検索を超えた意味的な情報発見を可能にする

**技術選定根拠**：  
- **動的検索API新設理由**: 静的なカテゴリ分類では対応できない複雑な市民ニーズに対応するため
- **リアルタイム更新**: 定期的なCKAN APIクロールにより、最新のデータセット情報を維持
- **キャッシュ戦略**: 頻繁にアクセスされるデータの高速化と、CKAN APIへの負荷軽減を両立

**パフォーマンス要件対応**：  
- **並列データ処理**: 複数データセットの同時処理により、検索時間を短縮
- **段階的データ取得**: データセットメタデータ → 実データの2段階取得により、初期レスポンスを高速化
- **適応的制限**: 処理可能なデータセット数の動的調整により、システム負荷を最適化

### 6.1 動的データ検索API

#### 6.1.1 エンドポイント
```
GET /api/data?query={query}&language={language}&dynamic={boolean}
```

#### 6.1.0 実装済み機能 ★NEW
- **CKAN API統合**: 東京都9,742件のデータセットにアクセス
- **多形式データ処理**: CSV, XLS, JSON, PDF, GeoJSON対応
- **インテリジェントマッチング**: AIで関連性評価
- **リアルタイム更新**: 最新データ取得

#### 6.1.2 リクエスト仕様

**クエリパラメータ**:
```typescript
interface DataSearchParams {
  query: string;             // 検索クエリ（必須）
  language?: Language;       // 検索言語（デフォルト: 'ja'）
  dynamic?: boolean;         // 動的検索の有効/無効（デフォルト: true）
  limit?: number;            // 結果件数制限（1-50、デフォルト: 10）
  category?: string;         // カテゴリフィルタ
}
```

#### 6.1.3 レスポンス仕様

```typescript
interface DataSearchResponse {
  items: OpenDataItem[];
  total: number;
  query: string;
  searchMethod: 'dynamic' | 'legacy';
  processingInfo: {
    totalDatasets: number;    // 検索対象データセット総数
    processedDatasets: number; // 実際に処理したデータセット数
    searchTime: number;       // 検索時間（ms）
    cacheUsed: boolean;       // キャッシュ使用フラグ
  };
}
```

### 6.2 カテゴリ別データ取得API

#### 6.2.1 エンドポイント
```
GET /api/data?category={category}
```

**対応カテゴリ**:
- `sources`: データソース一覧
- `stats`: 統計情報
- `childcare`: 子育て関連（従来互換）
- `welfare`: 福祉関連
- `environment`: 環境関連
- `transportation`: 交通関連
- `disaster`: 防災関連
- `economy`: 経済関連

#### 6.2.2 レスポンス例

**統計情報取得**:
```json
{
  "success": true,
  "data": {
    "totalDatasets": 9742,
    "categories": [
      {"name": "子育て・教育", "count": 1248},
      {"name": "福祉・医療", "count": 2156},
      {"name": "環境・エネルギー", "count": 892}
    ],
    "organizations": [
      {"name": "tokyo", "title": "東京都", "count": 5421},
      {"name": "setagaya", "title": "世田谷区", "count": 324}
    ],
    "lastUpdated": "2025-01-15T10:05:35.123Z"
  }
}
```

### 6.3 テストAPI

#### 6.3.1 エンドポイント
```
GET /api/data/test?query={query}&language={language}
POST /api/data/test
```

#### 6.3.2 機能
- 動的検索機能のテスト
- 統計情報取得のテスト
- データソース一覧取得のテスト
- バッチテスト（複数クエリの一括実行）

#### 6.3.3 バッチテストリクエスト例
```json
{
  "testQueries": [
    {"query": "保育園", "language": "ja"},
    {"query": "防災", "language": "ja"},
    {"query": "高齢者支援", "language": "ja"},
    {"query": "環境データ", "language": "ja"}
  ]
}
```

---

## 7. 検索API（新規実装） ★NEW

### 7.0 設計方針・根拠

**設計目標**：  
複数の検索手法を統合した包括的な検索機能により、市民の多様な情報ニーズに対する最適な回答を提供する。

**設計原則**：  
- **統合検索API新設理由**: 従来の単一検索手法では対応できない複雑な情報ニーズに対応するため、複数検索エンジンの結果を統合
- **並列検索実装**: ベクトル検索とオープンデータ検索の同時実行により、包括性と速度を両立
- **関連度スコア統合**: 異なる検索手法の結果を統一的なスコアで評価し、最適な情報を優先表示

**技術選定根拠**：  
- **Vertex Vector Search活用**: 意味的類似性に基づく高度な検索により、キーワードに依存しない情報発見を実現
- **ハイブリッド検索アプローチ**: 構造化データ検索と非構造化テキスト検索の組み合わせにより、検索精度を最大化
- **キャッシュ機能統合**: 検索結果の一時保存により、同様クエリへの高速レスポンスを実現

**拡張性要件対応**：  
- **モジュラー設計**: 新しい検索エンジンの追加が容易な設計により、将来的な機能拡張に対応
- **多言語検索対応**: 日本語・英語・中国語・韓国語への対応により、国際的な利用を想定
- **統計情報提供**: 検索動向の把握により、サービス改善のためのデータ蓄積を実現

### 7.1 統合検索API

#### 7.1.1 エンドポイント
```
POST /api/search
GET /api/search?type={type}
```

#### 7.1.2 実装済み機能 ★NEW
- **並列検索**: ベクトル検索 + オープンデータ検索
- **結果統合**: 関連度スコアによるランキング
- **統計情報**: データセット統計、推奨項目
- **キャッシュ機能**: 高速レスポンス

#### 7.1.3 リクエスト例
```typescript
// POST /api/search
interface SearchRequest {
  query: string;
  language?: 'ja' | 'en' | 'zh' | 'ko';
  limit?: number;
  includeStatistics?: boolean;
}

// GET /api/search?type=stats
// 統計情報取得
```

---

## 8. ヘルスチェックAPI（実装版）

### 8.0 設計方針・根拠

**設計目標**：  
システム全体の健康状態を包括的に監視し、障害の早期発見と迅速な対応により、高い可用性を実現する。

**設計原則**：  
- **包括的監視**: 内部サービス、外部API、インフラストラクチャの全てを監視対象とし、システム全体の健康状態を把握
- **階層的ステータス**: individual service → overall system の階層的状態評価により、障害箇所の特定を容易にする
- **メトリクス統合**: パフォーマンス指標と状態指標の統合により、予防的な監視を実現

**技術選定根拠**：  
- **リアルタイム監視**: 継続的なヘルスチェックにより、障害発生時の即座な検知を実現
- **外部依存関係監視**: Gemini API、Redis、CKAN APIの状態監視により、外部要因による障害の早期発見
- **自動復旧メカニズム**: degraded状態での部分的サービス継続により、完全な障害を回避

**可用性要件対応**：  
- **SLA監視**: レスポンス時間とエラー率の継続監視により、サービス品質の維持を確保
- **アラート統合**: 閾値ベースの自動アラートにより、運用チームへの迅速な通知を実現
- **ダッシュボード対応**: 監視データの可視化により、システム状態の直感的な把握を可能にする

### 8.1 システムヘルス

#### 8.1.1 エンドポイント
```
GET /api/health
```

#### 8.1.0 実装済み機能 ★NEW
- **サービス状態監視**: 全サービスの健康状態
- **パフォーマンスメトリクス**: レスポンス時間、メモリ使用率
- **環境情報**: バージョン、設定情報
- **外部サービス状態**: Gemini API, Redis, CKAN API

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

## 9. レート制限（実装版）

### 9.0 設計方針・根拠

**設計目標**：  
システムリソースの公平な利用と悪用防止により、全利用者に対する安定したサービス提供を実現する。

**設計原則**：  
- **エンドポイント別制限設定根拠**: 各APIの処理負荷と利用パターンに応じた個別制限により、効率的なリソース配分を実現
- **段階的制限実装**: IP制限 → セッション制限の段階的適用により、悪用防止と正常利用の両立
- **適応的制限調整**: システム負荷状況に応じた動的な制限値調整により、最適なサービス品質を維持

**制限値設定根拠**：  
- **チャットAPI (100回/15分)**: 高負荷なAI処理とデータ検索を考慮し、実用性と負荷軽減を両立
- **音声認識API (30回/5分)**: 大容量ファイル処理と高負荷なAI処理により、より厳格な制限を設定
- **データAPI (100回/1分)**: 大量データ処理の負荷を考慮し、短時間での制限を実装

**セキュリティ要件対応**：  
- **DDoS攻撃防止**: レート制限による自動的な攻撃緩和により、サービス継続性を確保
- **リソース枯渇防止**: CPU・メモリ・ネットワーク帯域の保護により、システム安定性を維持
- **公平性確保**: 特定利用者による独占的利用を防止し、多数の市民への公平なサービス提供を実現

### 9.1 制限設定

| エンドポイント | 制限 | ウィンドウ | 制限種別 | 備考 |
|----------------|------|------------|----------|------|
| `/api/chat` | 100回 | 15分 | セッション単位 | 高度AI機能含む ★実装値 |
| `/api/voice/recognize` | 30回 | 5分 | セッション単位 | ★実装値 |
| `/api/voice/synthesize` | 廃止 | - | - | Web Speech API使用 ★変更 |
| `/api/session` | 10回 | 1分 | IP単位 | |
| `/api/data` | 100回 | 1分 | IP単位 | 動的検索API ★実装済み |
| `/api/search` | 60回 | 5分 | セッション単位 | 統合検索API ★新規実装 |
| `/api/health` | 無制限 | - | - | ヘルスチェック ★実装済み |

### 9.2 制限レスポンス

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

## 10. 認証・認可

### 10.0 設計方針・根拠

**設計目標**：  
MVP版での簡素化と将来的な本格運用での拡張性を両立し、適切なセキュリティレベルでサービスを提供する。

**設計原則**：  
- **MVP版簡素化方針**: 初期段階での機能実証を重視し、複雑な認証機構を避けることで開発効率を優先
- **セッションベース認証選択理由**: ユーザー登録不要での利用を可能にし、アクセシビリティを向上
- **段階的セキュリティ強化**: MVP → 本格運用への移行時に、段階的なセキュリティ機能追加を想定

**技術選定根拠**：  
- **CORS設定**: 東京都ドメイン制限により、信頼できるソースからのアクセスのみを許可
- **HTTPS必須**: 全通信の暗号化により、セッションIDとデータの保護を確保
- **セッション有効期限**: 24時間の自動期限により、セッションハイジャックのリスクを軽減

**将来拡張対応**：  
- **API Key認証準備**: 外部システム連携時の認証機構として、API Key認証の実装準備
- **OAuth2.0対応**: 本格運用時の正式な認証機構として、標準的なOAuth2.0への移行を想定
- **監査ログ対応**: セキュリティインシデント対応のため、認証・認可関連の包括的ログ記録を実装

### 10.1 MVP版認証方針

MVP版では簡素化された認証を実装：
- **セッションベース認証**: ユーザー認証なし
- **API Key認証**: 外部サービス向け（将来拡張）
- **CORS設定**: 東京都ドメインからのアクセスのみ許可

### 10.2 セッション認証

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

## 11. API実装例

### 11.0 設計方針・根拠

**設計目標**：  
堅牢で保守性の高いAPI実装により、長期的な運用とメンテナンスを効率化する。

**設計原則**：  
- **エラーファースト設計**: 例外処理を最優先に設計し、予期しない状況でのシステム安定性を確保
- **型安全性重視**: TypeScript の活用により、開発時のエラー検出とリファクタリングの安全性を向上
- **ミドルウェア設計**: 共通処理の統一化により、コードの重複を削減し、メンテナンス性を向上

**実装品質確保**：  
- **包括的バリデーション**: 全入力データの検証により、セキュリティホールと予期しないエラーを防止
- **統一的エラーハンドリング**: withErrorHandler ミドルウェアにより、一貫したエラーレスポンスを保証
- **ログ・監査機能**: 全API呼び出しの記録により、問題発生時の迅速な原因特定を可能にする

**開発効率化対応**：  
- **再利用可能コンポーネント**: 共通的な処理の関数化により、開発効率とコード品質を向上
- **自動テスト対応**: テスタブルな設計により、継続的な品質確保を実現
- **文書化重視**: 実装例の提供により、開発チーム全体でのコード品質統一を実現

### 11.1 チャットAPI実装

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

### 11.2 音声認識API実装

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

## 12. 監視・ログ

### 12.0 設計方針・根拠

**設計目標**：  
包括的な監視とログ収集により、サービス品質の維持、問題の迅速な解決、継続的な改善を実現する。

**設計原則**：  
- **構造化ログ設計**: JSON形式の統一により、ログ解析の自動化と検索性能を向上
- **分離された責任**: アクセスログ、エラーログ、メトリクスの分離により、目的別の効率的な分析を実現
- **リアルタイム監視**: 継続的なメトリクス収集により、問題の早期発見と予防的対応を可能にする

**技術選定根拠**：  
- **構造化ログフォーマット**: 機械読み取り可能な形式により、自動化された監視とアラートを実現
- **包括的メトリクス**: エンドポイント別、外部サービス別の詳細な性能監視により、ボトルネックの特定を容易化
- **セキュリティログ**: 認証・認可関連の詳細ログにより、セキュリティインシデントの検知と対応を強化

**運用効率化対応**：  
- **自動アラート**: 閾値ベースの自動通知により、運用チームの負荷軽減と迅速な対応を実現
- **ダッシュボード統合**: リアルタイムでの状況把握により、プロアクティブな運用を可能にする
- **トレーサビリティ**: リクエストIDによる全処理の追跡により、複雑な問題の迅速な解決を支援

### 12.1 APIログ仕様

#### 12.1.1 アクセスログ

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

#### 12.1.2 エラーログ

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

### 12.2 メトリクス

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