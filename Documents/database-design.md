# 東京都公式アプリ AI音声対話機能
## データベース設計書（MVP版）

**文書情報**
- **文書名**: 東京都公式アプリ AI音声対話機能 データベース設計書（MVP版）
- **版数**: 1.0
- **作成日**: 2025年1月
- **作成者**: 根岸祐樹
- **備考**: MVP機能に限定したデータベース設計書

---

## 1. データベース構成概要

### 1.1 データストレージ戦略

MVPでは以下のデータストレージを組み合わせて使用：

```mermaid
graph TB
    subgraph "データストレージ構成"
        subgraph "一時データ"
            REDIS[Redis<br/>セッション管理<br/>キャッシュ]
        end
        
        subgraph "静的データ"
            CS[Cloud Storage<br/>オープンデータファイル<br/>音声ファイル]
        end
        
        subgraph "検索データ"
            VVS[Vertex Vector Search<br/>ベクトルインデックス<br/>メタデータ]
        end
        
        subgraph "ログデータ"
            CL[Cloud Logging<br/>アプリケーションログ<br/>監査ログ]
        end
    end
    
    subgraph "アプリケーション"
        APP[Next.js Application]
    end
    
    APP --> REDIS
    APP --> CS
    APP --> VVS
    APP --> CL
```

### 1.2 データ分類

| データ種別 | ストレージ | 保存期間 | 用途 |
|------------|------------|----------|------|
| **セッションデータ** | Redis | 1時間 | 対話履歴、コンテキスト管理 |
| **キャッシュデータ** | Redis | 5-30分 | API応答、検索結果 |
| **オープンデータ** | Cloud Storage | 永続 | 行政情報、育児情報 |
| **音声ファイル** | Cloud Storage | 一時 | 音声合成結果 |
| **ベクトルデータ** | Vertex Vector Search | 永続 | 検索インデックス |
| **ログデータ** | Cloud Logging | 30日 | 監査、デバッグ |

---

## 2. Redis データ設計

### 2.1 セッション管理

#### 2.1.1 セッションデータ構造

```typescript
// Redis Key Pattern: session:{sessionId}
interface SessionData {
  id: string;                    // セッションID
  userId?: string;               // ユーザーID（将来拡張用）
  language: 'ja' | 'en';         // 対応言語
  createdAt: string;             // 作成日時（ISO string）
  lastAccessedAt: string;        // 最終アクセス日時
  messages: SessionMessage[];    // 対話履歴
  context: SessionContext;       // コンテキスト情報
  preferences: UserPreferences;  // ユーザー設定
}

interface SessionMessage {
  id: string;                    // メッセージID
  type: 'user' | 'assistant';    // メッセージタイプ
  content: string;               // メッセージ内容
  timestamp: string;             // タイムスタンプ
  audioUrl?: string;             // 音声URL（音声合成時）
  metadata?: {
    sources?: string[];          // 参照データソース
    confidence?: number;         // 信頼度
    processingTime?: number;     // 処理時間（ms）
  };
}

interface SessionContext {
  topics: string[];              // 会話トピック
  entities: ExtractedEntity[];   // 抽出エンティティ
  location?: {                   // 位置情報（将来拡張用）
    prefecture: string;
    city: string;
    ward?: string;
  };
}

interface ExtractedEntity {
  type: 'age' | 'facility' | 'service' | 'location';
  value: string;
  confidence: number;
}

interface UserPreferences {
  voiceEnabled: boolean;         // 音声機能有効
  language: 'ja' | 'en';         // 優先言語
  responseLength: 'short' | 'normal' | 'detailed';
}
```

#### 2.1.2 セッション関連Redisコマンド

```redis
# セッション作成
SETEX session:abc123 3600 '{"id":"abc123","language":"ja",...}'

# セッション取得
GET session:abc123

# セッション更新（TTL延長）
EXPIRE session:abc123 3600

# セッション削除
DEL session:abc123

# 全セッション一覧（管理用）
KEYS session:*

# セッション統計
EVAL "return #redis.call('KEYS', 'session:*')" 0
```

### 2.2 キャッシュ設計

#### 2.2.1 API応答キャッシュ

```typescript
// Redis Key Pattern: cache:response:{hash}
interface ResponseCache {
  query: string;                 // 元のクエリ
  queryHash: string;             // クエリハッシュ
  language: string;              // 言語
  response: string;              // AI応答
  sources: string[];             // データソース
  confidence: number;            // 信頼度
  createdAt: string;             // キャッシュ作成日時
  accessCount: number;           // アクセス回数
}

// キャッシュキー生成
function generateCacheKey(query: string, language: string): string {
  const normalized = query.toLowerCase().trim();
  const hash = crypto
    .createHash('sha256')
    .update(`${normalized}:${language}`)
    .digest('hex');
  return `cache:response:${hash}`;
}
```

#### 2.2.2 検索結果キャッシュ

```typescript
// Redis Key Pattern: cache:search:{hash}
interface SearchCache {
  query: string;                 // 検索クエリ
  language: string;              // 言語
  results: SearchResult[];       // 検索結果
  totalCount: number;            // 総件数
  executionTime: number;         // 実行時間（ms）
  createdAt: string;             // キャッシュ作成日時
}

interface SearchResult {
  id: string;                    // データID
  title: string;                 // タイトル
  content: string;               // 内容
  category: string;              // カテゴリ
  url?: string;                  // 参照URL
  score: number;                 // 類似度スコア
  metadata: {
    source: string;              // データソース
    lastUpdated: string;         // 最終更新日
    tags: string[];              // タグ
  };
}
```

#### 2.2.3 キャッシュ管理

```redis
# 応答キャッシュ（5分）
SETEX cache:response:abc123 300 '{"response":"...","sources":["..."]}'

# 検索キャッシュ（30分）
SETEX cache:search:def456 1800 '{"results":[...],"totalCount":5}'

# キャッシュ統計
INFO memory
MEMORY USAGE cache:response:abc123

# キャッシュクリア
FLUSHDB

# パターンマッチキャッシュ削除
EVAL "
  local keys = redis.call('KEYS', ARGV[1])
  for i=1,#keys do
    redis.call('DEL', keys[i])
  end
  return #keys
" 0 cache:response:*
```

---

## 3. Cloud Storage データ設計

### 3.1 ディレクトリ構造

```
gs://tokyo-ai-chat-mvp/
├── opendata/                    # オープンデータ
│   ├── raw/                     # 生データ
│   │   ├── childcare/
│   │   │   ├── support-registry.xlsx
│   │   │   ├── daycare-list.csv
│   │   │   └── after-school-list.csv
│   │   └── metadata/
│   │       └── datasets.json
│   ├── processed/               # 処理済みデータ
│   │   ├── childcare/
│   │   │   ├── support-registry.json
│   │   │   ├── daycare-list.json
│   │   │   └── after-school-list.json
│   │   └── embeddings/
│   │       ├── childcare-embeddings.jsonl
│   │       └── metadata.json
│   └── archive/                 # アーカイブ
│       └── {date}/
├── audio/                       # 音声ファイル
│   ├── temp/                    # 一時音声ファイル
│   │   └── {sessionId}/
│   │       ├── input-{timestamp}.webm
│   │       └── output-{timestamp}.mp3
│   └── cache/                   # 音声キャッシュ
│       └── tts-{hash}.mp3
├── logs/                        # ログファイル（バックアップ）
│   └── {date}/
│       ├── application.log
│       ├── error.log
│       └── audit.log
└── config/                      # 設定ファイル
    ├── prompts/
    │   ├── system-prompt-ja.txt
    │   └── system-prompt-en.txt
    └── schemas/
        ├── opendata-schema.json
        └── api-schema.json
```

### 3.2 オープンデータファイル構造

#### 3.2.1 メタデータファイル

```json
// datasets.json
{
  "version": "1.0",
  "lastUpdated": "2025-01-15T10:00:00Z",
  "datasets": [
    {
      "id": "t134211d0000000001",
      "name": "子育て支援制度レジストリ",
      "description": "東京都の子育て支援制度一覧",
      "category": "childcare",
      "format": "xlsx",
      "url": "https://data.storage.data.metro.tokyo.lg.jp/...",
      "localPath": "opendata/raw/childcare/support-registry.xlsx",
      "processedPath": "opendata/processed/childcare/support-registry.json",
      "lastModified": "2025-01-10T15:30:00Z",
      "fileSize": 524288,
      "recordCount": 156,
      "columns": [
        {"name": "制度名", "type": "string", "required": true},
        {"name": "対象年齢", "type": "string", "required": true},
        {"name": "内容", "type": "text", "required": true},
        {"name": "申請方法", "type": "text", "required": false},
        {"name": "問い合わせ先", "type": "string", "required": false}
      ],
      "embeddings": {
        "model": "textembedding-gecko@003",
        "dimension": 768,
        "indexPath": "opendata/processed/embeddings/childcare-embeddings.jsonl",
        "lastIndexed": "2025-01-10T16:00:00Z"
      }
    }
  ]
}
```

#### 3.2.2 処理済みデータファイル

```json
// support-registry.json
{
  "metadata": {
    "sourceFile": "support-registry.xlsx",
    "processedAt": "2025-01-10T16:00:00Z",
    "totalRecords": 156,
    "language": "ja"
  },
  "records": [
    {
      "id": "childcare_001",
      "title": "児童手当",
      "content": "中学校卒業まで（15歳の誕生日後の最初の3月31日まで）の児童を養育している方に支給される手当です。",
      "category": "経済的支援",
      "targetAge": "0歳-15歳",
      "applicationMethod": "市区町村窓口での申請",
      "contactInfo": "各市区町村子育て支援課",
      "url": "https://www.metro.tokyo.lg.jp/...",
      "tags": ["手当", "経済支援", "児童"],
      "embedding": null,  // 実際のembeddingは別ファイル
      "lastUpdated": "2025-01-10T00:00:00Z"
    }
  ]
}
```

#### 3.2.3 Embeddingファイル

```jsonl
// childcare-embeddings.jsonl
{"id": "childcare_001", "text": "児童手当 中学校卒業まで 経済的支援", "embedding": [0.1, 0.2, ...], "metadata": {"category": "経済的支援"}}
{"id": "childcare_002", "text": "保育園入園 申込み手続き", "embedding": [0.3, 0.4, ...], "metadata": {"category": "保育サービス"}}
```

### 3.3 音声ファイル管理

#### 3.3.1 音声ファイル命名規則

```
# 入力音声（一時ファイル）
audio/temp/{sessionId}/input-{timestamp}.webm
例: audio/temp/abc123/input-20250115100530.webm

# 出力音声（一時ファイル）
audio/temp/{sessionId}/output-{timestamp}.mp3
例: audio/temp/abc123/output-20250115100535.mp3

# キャッシュ音声（TTS結果）
audio/cache/tts-{textHash}.mp3
例: audio/cache/tts-a1b2c3d4e5f6.mp3
```

#### 3.3.2 音声ファイルメタデータ

```json
// 音声ファイルのメタデータ（Cloud Storage metadata）
{
  "sessionId": "abc123",
  "timestamp": "2025-01-15T10:05:30Z",
  "type": "input|output",
  "format": "webm|mp3",
  "duration": 3.5,
  "fileSize": 45678,
  "language": "ja-JP",
  "textContent": "近くの保育園を教えてください",
  "ttl": "2025-01-15T11:05:30Z"
}
```

---

## 4. Vertex Vector Search 設計

### 4.1 インデックス構造

#### 4.1.1 インデックス設定

```yaml
# Vector Search Index Configuration
index_name: "tokyo-childcare-mvp"
display_name: "東京都育児情報検索インデックス（MVP）"
description: "育児・子育て関連情報のベクトル検索インデックス"

dimensions: 768  # textembedding-gecko@003
distance_measure_type: "COSINE_DISTANCE"
algorithm_config:
  tree_ah_config:
    leaf_node_embedding_count: 1000
    leaf_nodes_to_search_percent: 10

# Deployed Index Configuration
deployed_index_id: "tokyo_childcare_mvp_001"
automatic_resources:
  min_replica_count: 1
  max_replica_count: 3
```

#### 4.1.2 データポイント構造

```typescript
interface VectorDataPoint {
  datapoint_id: string;          // 一意識別子
  feature_vector: number[];      // 768次元ベクトル
  restricts: Restrict[];         // フィルタリング用
  crowding_tag?: string;         // クラスタリング用
}

interface Restrict {
  namespace: string;             // フィルタ名前空間
  allow_list?: string[];         // 許可リスト
  deny_list?: string[];          // 拒否リスト
}

// 例: 育児情報データポイント
{
  "datapoint_id": "childcare_001",
  "feature_vector": [0.1, 0.2, ...],  // 768次元
  "restricts": [
    {
      "namespace": "category",
      "allow_list": ["経済的支援", "保育サービス"]
    },
    {
      "namespace": "age_range",
      "allow_list": ["0-3歳", "4-6歳"]
    },
    {
      "namespace": "language",
      "allow_list": ["ja"]
    }
  ],
  "crowding_tag": "childcare"
}
```

### 4.2 検索クエリ設計

#### 4.2.1 基本検索クエリ

```typescript
interface VectorSearchQuery {
  deployed_index_id: string;
  queries: VectorQuery[];
}

interface VectorQuery {
  datapoint: {
    datapoint_id: string;
    feature_vector: number[];    // クエリベクトル
  };
  neighbor_count: number;        // 取得件数
  per_crowding_attribute_neighbor_count?: number;
  approximate_neighbor_count?: number;
  fraction_leaf_nodes_to_search_override?: number;
  restricts?: Restrict[];        // フィルタ条件
}

// 使用例
const searchQuery: VectorSearchQuery = {
  deployed_index_id: "tokyo_childcare_mvp_001",
  queries: [
    {
      datapoint: {
        datapoint_id: "query_001",
        feature_vector: queryEmbedding  // [0.1, 0.2, ...]
      },
      neighbor_count: 10,
      restricts: [
        {
          namespace: "category",
          allow_list: ["保育サービス"]
        },
        {
          namespace: "language",
          allow_list: ["ja"]
        }
      ]
    }
  ]
};
```

#### 4.2.2 カテゴリ別フィルタリング

```typescript
// 育児情報カテゴリ定義
enum ChildcareCategory {
  ECONOMIC_SUPPORT = "経済的支援",      // 児童手当、給付金等
  CHILDCARE_SERVICE = "保育サービス",   // 保育園、学童等
  HEALTH_SERVICE = "健康サービス",      // 健診、医療等
  EDUCATION_SUPPORT = "教育支援",       // 就学援助等
  FACILITY_INFO = "施設情報",           // 子育て支援施設等
  CONSULTATION = "相談窓口"             // 子育て相談等
}

// 年齢層フィルタ
enum AgeRange {
  INFANT = "0-2歳",          // 乳児
  TODDLER = "3-5歳",         // 幼児
  ELEMENTARY = "6-12歳",     // 小学生
  MIDDLE_SCHOOL = "13-15歳"  // 中学生
}

// フィルタ生成関数
function createCategoryFilter(categories: ChildcareCategory[]): Restrict {
  return {
    namespace: "category",
    allow_list: categories
  };
}

function createAgeFilter(ageRanges: AgeRange[]): Restrict {
  return {
    namespace: "age_range",
    allow_list: ageRanges
  };
}
```

---

## 5. データ処理パイプライン

### 5.1 オープンデータ取得・処理フロー

#### 5.1.1 データ取得処理

```typescript
interface DataProcessingPipeline {
  // 1. データセット情報取得
  fetchDatasetMetadata(): Promise<DatasetMetadata[]>;
  
  // 2. ファイルダウンロード
  downloadFile(dataset: DatasetMetadata): Promise<string>;
  
  // 3. データ解析・正規化
  parseAndNormalize(filePath: string, format: string): Promise<ProcessedRecord[]>;
  
  // 4. Embedding生成
  generateEmbeddings(records: ProcessedRecord[]): Promise<EmbeddingRecord[]>;
  
  // 5. インデックス更新
  updateVectorIndex(embeddings: EmbeddingRecord[]): Promise<void>;
  
  // 6. キャッシュクリア
  clearRelatedCache(): Promise<void>;
}

interface ProcessedRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  targetAge?: string;
  tags: string[];
  metadata: {
    source: string;
    lastUpdated: string;
    url?: string;
  };
}

interface EmbeddingRecord extends ProcessedRecord {
  embedding: number[];
  searchText: string;  // embedding生成用テキスト
}
```

#### 5.1.2 バッチ処理スケジュール

```typescript
// データ更新スケジュール
const UPDATE_SCHEDULE = {
  // 毎日午前2時にチェック
  DAILY_CHECK: "0 2 * * *",
  
  // 毎週月曜日午前1時に全更新
  WEEKLY_FULL_UPDATE: "0 1 * * 1",
  
  // 毎月1日午前0時にアーカイブ
  MONTHLY_ARCHIVE: "0 0 1 * *"
};

// 処理ステップ
enum ProcessingStep {
  METADATA_FETCH = "metadata_fetch",
  FILE_DOWNLOAD = "file_download",
  DATA_PARSING = "data_parsing",
  EMBEDDING_GENERATION = "embedding_generation",
  INDEX_UPDATE = "index_update",
  CACHE_CLEAR = "cache_clear",
  CLEANUP = "cleanup"
}

interface ProcessingStatus {
  jobId: string;
  startTime: Date;
  currentStep: ProcessingStep;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  errors: ProcessingError[];
  estimatedCompletion?: Date;
}
```

### 5.2 リアルタイムデータ処理

#### 5.2.1 増分更新処理

```typescript
class IncrementalUpdateProcessor {
  async processIncrementalUpdate(datasetId: string): Promise<void> {
    // 1. 最終更新時刻取得
    const lastUpdate = await this.getLastUpdateTime(datasetId);
    
    // 2. 新規/更新データ特定
    const changedRecords = await this.identifyChangedRecords(
      datasetId, 
      lastUpdate
    );
    
    if (changedRecords.length === 0) {
      return; // 更新なし
    }
    
    // 3. 削除対象データの特定
    const deletedRecords = await this.identifyDeletedRecords(
      datasetId, 
      changedRecords
    );
    
    // 4. ベクトルインデックスから削除
    if (deletedRecords.length > 0) {
      await this.removeFromVectorIndex(deletedRecords);
    }
    
    // 5. 新規/更新データのembedding生成
    const embeddings = await this.generateEmbeddings(changedRecords);
    
    // 6. ベクトルインデックスに追加/更新
    await this.upsertToVectorIndex(embeddings);
    
    // 7. 関連キャッシュクリア
    await this.clearRelatedCache(datasetId);
    
    // 8. 更新時刻記録
    await this.updateLastUpdateTime(datasetId, new Date());
  }
}
```

---

## 6. データ品質・整合性管理

### 6.1 データバリデーション

#### 6.1.1 スキーマ検証

```typescript
// データスキーマ定義
interface ChildcareRecordSchema {
  id: string;                    // 必須, 一意
  title: string;                 // 必須, 1-200文字
  content: string;               // 必須, 10-2000文字
  category: ChildcareCategory;   // 必須, 列挙値
  targetAge?: string;            // オプション, パターンマッチ
  applicationMethod?: string;    // オプション, 1-500文字
  contactInfo?: string;          // オプション, 1-200文字
  url?: string;                  // オプション, URL形式
  tags: string[];                // 必須, 1-10個
  lastUpdated: string;           // 必須, ISO日付形式
}

// バリデーション実装
class DataValidator {
  validateRecord(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // 必須フィールドチェック
    if (!record.id) {
      errors.push(new ValidationError('id', 'ID is required'));
    }
    
    // 文字数チェック
    if (record.title && record.title.length > 200) {
      errors.push(new ValidationError('title', 'Title too long'));
    }
    
    // カテゴリチェック
    if (record.category && !Object.values(ChildcareCategory).includes(record.category)) {
      errors.push(new ValidationError('category', 'Invalid category'));
    }
    
    // URL形式チェック
    if (record.url && !this.isValidUrl(record.url)) {
      errors.push(new ValidationError('url', 'Invalid URL format'));
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

#### 6.1.2 重複データ検出

```typescript
class DuplicateDetector {
  async detectDuplicates(records: ProcessedRecord[]): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = [];
    
    // タイトルベースの完全一致検出
    const titleGroups = this.groupByTitle(records);
    for (const [title, group] of titleGroups) {
      if (group.length > 1) {
        duplicateGroups.push({
          type: 'exact_title',
          records: group,
          similarity: 1.0
        });
      }
    }
    
    // コンテンツベースの類似度検出
    const similarityGroups = await this.detectSimilarContent(records);
    duplicateGroups.push(...similarityGroups);
    
    return duplicateGroups;
  }
  
  private async detectSimilarContent(
    records: ProcessedRecord[]
  ): Promise<DuplicateGroup[]> {
    const embeddings = await Promise.all(
      records.map(r => this.generateEmbedding(r.content))
    );
    
    const similarGroups: DuplicateGroup[] = [];
    const SIMILARITY_THRESHOLD = 0.9;
    
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const similarity = this.cosineSimilarity(
          embeddings[i], 
          embeddings[j]
        );
        
        if (similarity > SIMILARITY_THRESHOLD) {
          similarGroups.push({
            type: 'similar_content',
            records: [records[i], records[j]],
            similarity
          });
        }
      }
    }
    
    return similarGroups;
  }
}
```

### 6.2 データ整合性チェック

#### 6.2.1 参照整合性

```typescript
class DataIntegrityChecker {
  async checkIntegrity(): Promise<IntegrityReport> {
    const report: IntegrityReport = {
      timestamp: new Date(),
      checks: []
    };
    
    // 1. オープンデータファイル存在チェック
    report.checks.push(await this.checkFileExistence());
    
    // 2. ベクトルインデックス整合性チェック
    report.checks.push(await this.checkVectorIndexIntegrity());
    
    // 3. キャッシュ整合性チェック
    report.checks.push(await this.checkCacheIntegrity());
    
    // 4. セッションデータ整合性チェック
    report.checks.push(await this.checkSessionIntegrity());
    
    return report;
  }
  
  private async checkVectorIndexIntegrity(): Promise<IntegrityCheck> {
    const check: IntegrityCheck = {
      name: 'vector_index_integrity',
      status: 'pending',
      details: []
    };
    
    try {
      // Cloud Storageの処理済みデータ数取得
      const storageRecordCount = await this.getStorageRecordCount();
      
      // Vector Searchのデータポイント数取得
      const indexRecordCount = await this.getVectorIndexRecordCount();
      
      if (storageRecordCount !== indexRecordCount) {
        check.status = 'failed';
        check.details.push({
          message: `Record count mismatch: Storage=${storageRecordCount}, Index=${indexRecordCount}`,
          severity: 'error'
        });
      } else {
        check.status = 'passed';
        check.details.push({
          message: `Record count matches: ${storageRecordCount}`,
          severity: 'info'
        });
      }
    } catch (error) {
      check.status = 'error';
      check.details.push({
        message: `Integrity check failed: ${error.message}`,
        severity: 'error'
      });
    }
    
    return check;
  }
}
```

---

## 7. バックアップ・復旧設計

### 7.1 バックアップ戦略

#### 7.1.1 データ種別別バックアップ

| データ種別 | バックアップ頻度 | 保存期間 | 復旧目標時間 |
|------------|------------------|----------|--------------|
| **オープンデータ** | 日次 | 90日 | 30分 |
| **ベクトルインデックス** | 週次 | 30日 | 2時間 |
| **設定ファイル** | 変更時 | 無期限 | 5分 |
| **ログデータ** | 日次 | 30日 | - |

#### 7.1.2 バックアップ実装

```typescript
class BackupManager {
  async performDailyBackup(): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupPath = `backup/${timestamp}`;
    
    // 1. オープンデータバックアップ
    await this.backupOpenData(backupPath);
    
    // 2. 設定ファイルバックアップ
    await this.backupConfigurations(backupPath);
    
    // 3. メタデータバックアップ
    await this.backupMetadata(backupPath);
    
    // 4. 古いバックアップ削除（90日以前）
    await this.cleanupOldBackups(90);
  }
  
  private async backupOpenData(backupPath: string): Promise<void> {
    const sourcePrefix = 'opendata/processed/';
    const targetPrefix = `${backupPath}/opendata/`;
    
    await this.cloudStorage.copy(sourcePrefix, targetPrefix);
  }
  
  async restoreFromBackup(backupDate: string): Promise<void> {
    const backupPath = `backup/${backupDate}`;
    
    // 1. バックアップ存在確認
    const exists = await this.cloudStorage.exists(backupPath);
    if (!exists) {
      throw new Error(`Backup not found: ${backupDate}`);
    }
    
    // 2. 現在のデータをアーカイブ
    await this.archiveCurrentData();
    
    // 3. バックアップからリストア
    await this.cloudStorage.copy(
      `${backupPath}/opendata/`,
      'opendata/processed/'
    );
    
    // 4. ベクトルインデックス再構築
    await this.rebuildVectorIndex();
    
    // 5. キャッシュクリア
    await this.clearAllCache();
  }
}
```

### 7.2 災害復旧計画

#### 7.2.1 復旧手順

```typescript
enum DisasterRecoveryScenario {
  PARTIAL_OUTAGE = 'partial_outage',      // 部分障害
  FULL_OUTAGE = 'full_outage',            // 全面障害
  DATA_CORRUPTION = 'data_corruption',    // データ破損
  SECURITY_INCIDENT = 'security_incident' // セキュリティインシデント
}

class DisasterRecoveryManager {
  async executeRecoveryPlan(scenario: DisasterRecoveryScenario): Promise<void> {
    switch (scenario) {
      case DisasterRecoveryScenario.PARTIAL_OUTAGE:
        await this.handlePartialOutage();
        break;
      case DisasterRecoveryScenario.FULL_OUTAGE:
        await this.handleFullOutage();
        break;
      case DisasterRecoveryScenario.DATA_CORRUPTION:
        await this.handleDataCorruption();
        break;
      case DisasterRecoveryScenario.SECURITY_INCIDENT:
        await this.handleSecurityIncident();
        break;
    }
  }
  
  private async handleFullOutage(): Promise<void> {
    // 1. インフラストラクチャ復旧
    await this.restoreInfrastructure();
    
    // 2. データベース復旧
    await this.restoreRedis();
    
    // 3. ストレージ復旧
    await this.restoreCloudStorage();
    
    // 4. ベクトルインデックス復旧
    await this.restoreVectorIndex();
    
    // 5. アプリケーション復旧
    await this.restoreApplication();
    
    // 6. 動作確認
    await this.performHealthCheck();
  }
}
```

この設計書では、MVP版のデータベース・ストレージ設計を詳細に定義しました。次に、API設計書の作成に進みます。