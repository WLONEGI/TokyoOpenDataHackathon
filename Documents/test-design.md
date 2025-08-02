# 東京都公式アプリ AI音声対話機能
## テスト設計書（MVP版）

**文書情報**
- **文書名**: 東京都公式アプリ AI音声対話機能 テスト設計書（MVP版）
- **版数**: 1.0
- **作成日**: 2025年1月
- **作成者**: 根岸祐樹
- **備考**: MVP機能に限定したテスト設計書

---

## 1. テスト戦略概要

### 1.1 テストピラミッド

```mermaid
graph TB
    subgraph "テストピラミッド"
        E2E[E2Eテスト<br/>5%<br/>ユーザーシナリオ]
        INT[統合テスト<br/>20%<br/>API・サービス間連携]
        UNIT[単体テスト<br/>75%<br/>関数・コンポーネント]
    end
    
    E2E --> INT
    INT --> UNIT
    
    style E2E fill:#ff9999
    style INT fill:#ffcc99
    style UNIT fill:#99ff99
```

### 1.2 テスト方針

#### 1.2.1 基本方針
- **品質重視**: 機能性、性能、セキュリティを重点的にテスト
- **自動化**: 可能な限りテストを自動化
- **継続的テスト**: CI/CDパイプラインに組み込み
- **実環境テスト**: 本番環境に近い条件でテスト
- **多言語対応**: 日本語・英語での動作確認

#### 1.2.2 MVP範囲でのテスト対象

| カテゴリ | 対象機能 | テスト種別 | 優先度 |
|----------|----------|------------|--------|
| **チャット機能** | テキスト対話、セッション管理 | 単体・統合・E2E | 最高 |
| **音声機能** | 音声認識・合成 | 統合・E2E | 最高 |
| **データ検索** | ベクトル検索、オープンデータ連携 | 単体・統合 | 高 |
| **API** | REST API、エラーハンドリング | 単体・統合 | 高 |
| **セキュリティ** | 入力検証、レート制限 | 単体・セキュリティ | 高 |
| **パフォーマンス** | 応答時間、スループット | パフォーマンス | 中 |

---

## 2. 単体テスト設計

### 2.1 フロントエンド単体テスト

#### 2.1.1 テストフレームワーク構成

```json
{
  "dependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "msw": "^2.0.0"
  }
}
```

#### 2.1.2 コンポーネントテスト例

```typescript
// __tests__/components/ChatContainer.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChatProvider } from '@/contexts/ChatContext';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// MSWサーバーセットアップ
const server = setupServer(
  rest.post('/api/chat', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          content: 'テストレスポンス',
          sessionId: 'test-session-123',
          metadata: {
            processingTime: 1000,
            confidence: 0.95,
            language: 'ja'
          }
        }
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ChatContainer', () => {
  const renderChatContainer = () => {
    return render(
      <ChatProvider>
        <ChatContainer />
      </ChatProvider>
    );
  };

  test('メッセージ入力・送信ができる', async () => {
    const user = userEvent.setup();
    renderChatContainer();

    // 入力フィールドの存在確認
    const messageInput = screen.getByPlaceholderText('メッセージを入力してください...');
    expect(messageInput).toBeInTheDocument();

    // メッセージ入力
    await user.type(messageInput, '近くの保育園を教えてください');
    
    // 送信ボタンクリック
    const sendButton = screen.getByRole('button', { name: '送信' });
    await user.click(sendButton);

    // ユーザーメッセージの表示確認
    expect(screen.getByText('近くの保育園を教えてください')).toBeInTheDocument();

    // AIレスポンスの表示確認
    await waitFor(() => {
      expect(screen.getByText('テストレスポンス')).toBeInTheDocument();
    });

    // 入力フィールドがクリアされることを確認
    expect(messageInput).toHaveValue('');
  });

  test('空メッセージは送信できない', async () => {
    const user = userEvent.setup();
    renderChatContainer();

    const sendButton = screen.getByRole('button', { name: '送信' });
    
    // 空の状態で送信ボタンクリック
    await user.click(sendButton);

    // エラーメッセージの表示確認
    expect(screen.getByText('メッセージを入力してください')).toBeInTheDocument();
  });

  test('長すぎるメッセージはエラーになる', async () => {
    const user = userEvent.setup();
    renderChatContainer();

    const messageInput = screen.getByPlaceholderText('メッセージを入力してください...');
    
    // 1000文字超えのメッセージ
    const longMessage = 'あ'.repeat(1001);
    await user.type(messageInput, longMessage);

    const sendButton = screen.getByRole('button', { name: '送信' });
    await user.click(sendButton);

    // エラーメッセージの確認
    expect(screen.getByText('メッセージが長すぎます（最大1000文字）')).toBeInTheDocument();
  });

  test('ローディング状態が正しく表示される', async () => {
    const user = userEvent.setup();
    
    // 遅延レスポンスのモック
    server.use(
      rest.post('/api/chat', (req, res, ctx) => {
        return res(
          ctx.delay(2000),
          ctx.json({
            success: true,
            data: { content: 'レスポンス', sessionId: 'test-session' }
          })
        );
      })
    );

    renderChatContainer();

    const messageInput = screen.getByPlaceholderText('メッセージを入力してください...');
    await user.type(messageInput, 'テストメッセージ');

    const sendButton = screen.getByRole('button', { name: '送信' });
    await user.click(sendButton);

    // ローディング表示の確認
    expect(screen.getByText('回答を生成中...')).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
  });
});
```

#### 2.1.3 音声機能テスト

```typescript
// __tests__/components/VoiceInput.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceInput } from '@/components/chat/VoiceInput';

// Web Audio API のモック
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  state: 'inactive'
};

const mockMediaStream = {
  getTracks: jest.fn(() => [{ stop: jest.fn() }])
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve(mockMediaStream))
  }
});

Object.defineProperty(global, 'MediaRecorder', {
  value: jest.fn(() => mockMediaRecorder)
});

describe('VoiceInput', () => {
  const mockOnTranscript = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('音声録音の開始・停止ができる', async () => {
    const user = userEvent.setup();
    
    render(
      <VoiceInput
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );

    const voiceButton = screen.getByRole('button', { name: '音声入力' });
    
    // 録音開始
    await user.click(voiceButton);
    
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true
    });
    expect(mockMediaRecorder.start).toHaveBeenCalled();
    
    // 録音中の表示確認
    expect(screen.getByText('録音中...')).toBeInTheDocument();
    
    // 録音停止
    await user.click(voiceButton);
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
  });

  test('マイクアクセスが拒否された場合のエラーハンドリング', async () => {
    const user = userEvent.setup();
    
    // getUserMediaのエラーモック
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    render(
      <VoiceInput
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );

    const voiceButton = screen.getByRole('button', { name: '音声入力' });
    await user.click(voiceButton);

    expect(mockOnError).toHaveBeenCalledWith('マイクへのアクセスが拒否されました');
  });

  test('音声認識結果が正しく処理される', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
    
    // MediaRecorderのdatavailableイベントをシミュレート
    const dataAvailableCallback = jest.fn();
    (mockMediaRecorder.addEventListener as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'dataavailable') {
        dataAvailableCallback.mockImplementation(callback);
      }
    });

    render(
      <VoiceInput
        onTranscript={mockOnTranscript}
        onError={mockOnError}
      />
    );

    // 音声データイベントをトリガー
    dataAvailableCallback({ data: mockBlob });

    // 音声認識処理が呼ばれることを確認
    // (実際の実装では音声認識APIが呼ばれる)
  });
});
```

### 2.2 バックエンド単体テスト

#### 2.2.1 サービスクラステスト

```typescript
// __tests__/services/ChatService.test.ts
import { ChatService } from '@/services/ChatService';
import { SessionService } from '@/services/SessionService';
import { SearchService } from '@/services/SearchService';
import { GeminiClient } from '@/services/integration/GeminiClient';

// モック設定
jest.mock('@/services/SessionService');
jest.mock('@/services/SearchService');
jest.mock('@/services/integration/GeminiClient');

describe('ChatService', () => {
  let chatService: ChatService;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockSearchService: jest.Mocked<SearchService>;
  let mockGeminiClient: jest.Mocked<GeminiClient>;

  beforeEach(() => {
    mockSessionService = new SessionService() as jest.Mocked<SessionService>;
    mockSearchService = new SearchService() as jest.Mocked<SearchService>;
    mockGeminiClient = new GeminiClient() as jest.Mocked<GeminiClient>;
    
    chatService = new ChatService(
      mockSessionService,
      mockSearchService,
      mockGeminiClient
    );
  });

  describe('processMessage', () => {
    test('正常なメッセージ処理ができる', async () => {
      // モックデータ設定
      const mockSession = {
        id: 'test-session',
        language: 'ja',
        messages: [],
        context: { topics: [], entities: [] }
      };
      
      const mockSearchResults = [
        {
          id: 'childcare_001',
          title: '保育園情報',
          content: '認可保育園の一覧です',
          score: 0.9
        }
      ];

      const mockAIResponse = '近くの保育園についてお答えします...';

      // モック関数の戻り値設定
      mockSessionService.getSession.mockResolvedValue(mockSession);
      mockSearchService.searchRelevantData.mockResolvedValue(mockSearchResults);
      mockGeminiClient.generateResponse.mockResolvedValue(mockAIResponse);
      mockSessionService.updateSession.mockResolvedValue();

      // テスト実行
      const result = await chatService.processMessage(
        'test-session',
        '近くの保育園を教えてください',
        'ja'
      );

      // 検証
      expect(result).toEqual({
        content: mockAIResponse,
        sessionId: 'test-session',
        sources: mockSearchResults,
        metadata: expect.objectContaining({
          language: 'ja',
          confidence: expect.any(Number),
          processingTime: expect.any(Number)
        })
      });

      // 各サービスが正しく呼ばれたか確認
      expect(mockSessionService.getSession).toHaveBeenCalledWith('test-session');
      expect(mockSearchService.searchRelevantData).toHaveBeenCalledWith(
        '近くの保育園を教えてください',
        'ja'
      );
      expect(mockGeminiClient.generateResponse).toHaveBeenCalled();
      expect(mockSessionService.updateSession).toHaveBeenCalled();
    });

    test('セッションが見つからない場合はエラーが発生する', async () => {
      mockSessionService.getSession.mockResolvedValue(null);

      await expect(
        chatService.processMessage('invalid-session', 'test message', 'ja')
      ).rejects.toThrow('Session not found');
    });

    test('空のメッセージは処理できない', async () => {
      await expect(
        chatService.processMessage('test-session', '', 'ja')
      ).rejects.toThrow('Message cannot be empty');

      await expect(
        chatService.processMessage('test-session', '   ', 'ja')
      ).rejects.toThrow('Message cannot be empty');
    });

    test('長すぎるメッセージは処理できない', async () => {
      const longMessage = 'a'.repeat(1001);
      
      await expect(
        chatService.processMessage('test-session', longMessage, 'ja')
      ).rejects.toThrow('Message too long');
    });

    test('外部API障害時の適切なエラーハンドリング', async () => {
      const mockSession = {
        id: 'test-session',
        language: 'ja',
        messages: [],
        context: { topics: [], entities: [] }
      };

      mockSessionService.getSession.mockResolvedValue(mockSession);
      mockSearchService.searchRelevantData.mockResolvedValue([]);
      mockGeminiClient.generateResponse.mockRejectedValue(
        new Error('Gemini API unavailable')
      );

      await expect(
        chatService.processMessage('test-session', 'test message', 'ja')
      ).rejects.toThrow('External service error');
    });
  });
});
```

#### 2.2.2 バリデーション関数テスト

```typescript
// __tests__/lib/validation.test.ts
import {
  validateChatMessage,
  validateSessionId,
  validateAudioFile,
  sanitizeInput
} from '@/lib/validation';

describe('Validation Functions', () => {
  describe('validateChatMessage', () => {
    test('正常なメッセージは通る', () => {
      const result = validateChatMessage('こんにちは');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('空のメッセージはエラー', () => {
      const result = validateChatMessage('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message cannot be empty');
    });

    test('空白のみのメッセージはエラー', () => {
      const result = validateChatMessage('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message cannot be empty');
    });

    test('長すぎるメッセージはエラー', () => {
      const longMessage = 'あ'.repeat(1001);
      const result = validateChatMessage(longMessage);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message too long');
    });

    test('危険なスクリプトタグは検出される', () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      const result = validateChatMessage(maliciousMessage);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Potentially malicious content detected');
    });

    test('JavaScriptイベントハンドラーは検出される', () => {
      const maliciousMessage = '<div onclick="alert()">test</div>';
      const result = validateChatMessage(maliciousMessage);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Potentially malicious content detected');
    });
  });

  describe('validateSessionId', () => {
    test('正しいUUID形式は通る', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000-1234567890-abcdef';
      const result = validateSessionId(validUuid);
      expect(result.valid).toBe(true);
    });

    test('無効な形式はエラー', () => {
      const invalidUuid = 'invalid-session-id';
      const result = validateSessionId(invalidUuid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid session ID format');
    });

    test('nullやundefinedはエラー', () => {
      expect(validateSessionId(null as any).valid).toBe(false);
      expect(validateSessionId(undefined as any).valid).toBe(false);
    });
  });

  describe('validateAudioFile', () => {
    test('有効な音声ファイルは通る', async () => {
      const mockFile = new File(['audio data'], 'test.webm', {
        type: 'audio/webm'
      });
      
      const result = await validateAudioFile(mockFile);
      expect(result.valid).toBe(true);
    });

    test('サイズが大きすぎるファイルはエラー', async () => {
      const largeData = new Array(11 * 1024 * 1024).fill('a').join(''); // 11MB
      const mockFile = new File([largeData], 'large.webm', {
        type: 'audio/webm'
      });
      
      const result = await validateAudioFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File too large');
    });

    test('サポートされていない形式はエラー', async () => {
      const mockFile = new File(['video data'], 'test.mp4', {
        type: 'video/mp4'
      });
      
      const result = await validateAudioFile(mockFile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unsupported file format');
    });
  });

  describe('sanitizeInput', () => {
    test('HTMLタグがエスケープされる', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeInput(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('特殊文字がエスケープされる', () => {
      const input = `<>&"'/`;
      const result = sanitizeInput(input);
      expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;');
    });

    test('通常のテキストは変更されない', () => {
      const input = 'こんにちは、保育園について教えてください。';
      const result = sanitizeInput(input);
      expect(result).toBe(input);
    });
  });
});
```

---

## 3. 統合テスト設計

### 3.1 API統合テスト

#### 3.1.1 テスト環境設定

```typescript
// __tests__/integration/setup.ts
import { NextApiHandler } from 'next';
import { createMocks } from 'node-mocks-http';
import { TestContainer } from 'typedi';

// テスト用依存性注入コンテナ
export class TestEnvironment {
  private container: TestContainer;
  
  constructor() {
    this.container = new TestContainer();
    this.setupMocks();
  }

  private setupMocks() {
    // Redis モック
    const mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn()
    };

    // Gemini API モック
    const mockGeminiClient = {
      generateResponse: jest.fn(),
      speechToText: jest.fn(),
      textToSpeech: jest.fn(),
      generateEmbedding: jest.fn()
    };

    // Vector Search モック
    const mockVectorSearch = {
      search: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn()
    };

    this.container.set('redis', mockRedis);
    this.container.set('gemini', mockGeminiClient);
    this.container.set('vectorSearch', mockVectorSearch);
  }

  async callAPI(handler: NextApiHandler, method: string, body?: any) {
    const { req, res } = createMocks({ method, body });
    
    // セッションIDを自動生成
    req.headers['x-session-id'] = 'test-session-' + Date.now();
    
    await handler(req, res);
    
    return {
      statusCode: res._getStatusCode(),
      data: JSON.parse(res._getData())
    };
  }

  getMock(service: string) {
    return this.container.get(service);
  }

  cleanup() {
    jest.clearAllMocks();
  }
}
```

#### 3.1.2 チャットAPI統合テスト

```typescript
// __tests__/integration/api/chat.test.ts
import chatHandler from '@/pages/api/chat';
import { TestEnvironment } from '../setup';

describe('/api/chat Integration Tests', () => {
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = new TestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  test('正常なチャットフロー', async () => {
    // モックレスポンス設定
    const mockRedis = testEnv.getMock('redis');
    const mockGemini = testEnv.getMock('gemini');
    const mockVectorSearch = testEnv.getMock('vectorSearch');

    // セッション存在のモック
    mockRedis.get.mockResolvedValue(JSON.stringify({
      id: 'test-session',
      language: 'ja',
      messages: [],
      context: { topics: [], entities: [] }
    }));

    // ベクトル検索結果のモック
    mockVectorSearch.search.mockResolvedValue([
      {
        id: 'childcare_001',
        score: 0.9,
        metadata: {
          title: '保育園情報',
          content: '認可保育園の一覧です'
        }
      }
    ]);

    // Gemini API レスポンスのモック
    mockGemini.generateResponse.mockResolvedValue(
      'お近くの保育園についてご案内します...'
    );

    // API呼び出し
    const response = await testEnv.callAPI(chatHandler, 'POST', {
      message: '近くの保育園を教えてください',
      language: 'ja'
    });

    // レスポンス検証
    expect(response.statusCode).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toMatchObject({
      content: expect.stringContaining('保育園'),
      sessionId: expect.any(String),
      metadata: {
        language: 'ja',
        confidence: expect.any(Number),
        processingTime: expect.any(Number)
      }
    });

    // 各サービスが適切に呼ばれたことを確認
    expect(mockRedis.get).toHaveBeenCalled();
    expect(mockVectorSearch.search).toHaveBeenCalled();
    expect(mockGemini.generateResponse).toHaveBeenCalled();
    expect(mockRedis.setex).toHaveBeenCalled(); // セッション更新
  });

  test('不正なリクエストボディ', async () => {
    const response = await testEnv.callAPI(chatHandler, 'POST', {
      // messageが欠けている
      language: 'ja'
    });

    expect(response.statusCode).toBe(400);
    expect(response.data.success).toBe(false);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('存在しないセッション', async () => {
    const mockRedis = testEnv.getMock('redis');
    mockRedis.get.mockResolvedValue(null);

    const response = await testEnv.callAPI(chatHandler, 'POST', {
      message: 'テストメッセージ',
      sessionId: 'non-existent-session'
    });

    expect(response.statusCode).toBe(404);
    expect(response.data.error.code).toBe('SESSION_NOT_FOUND');
  });

  test('外部API障害時のエラーハンドリング', async () => {
    const mockRedis = testEnv.getMock('redis');
    const mockGemini = testEnv.getMock('gemini');

    mockRedis.get.mockResolvedValue(JSON.stringify({
      id: 'test-session',
      language: 'ja',
      messages: [],
      context: { topics: [], entities: [] }
    }));

    // Gemini API エラーのモック
    mockGemini.generateResponse.mockRejectedValue(
      new Error('API quota exceeded')
    );

    const response = await testEnv.callAPI(chatHandler, 'POST', {
      message: 'テストメッセージ'
    });

    expect(response.statusCode).toBe(503);
    expect(response.data.error.code).toBe('EXTERNAL_SERVICE_ERROR');
  });

  test('レート制限テスト', async () => {
    const mockRedis = testEnv.getMock('redis');
    
    // レート制限カウンターのモック
    mockRedis.get
      .mockResolvedValueOnce('60') // すでに上限に達している
      .mockResolvedValue(JSON.stringify({
        id: 'test-session',
        language: 'ja',
        messages: [],
        context: { topics: [], entities: [] }
      }));

    const response = await testEnv.callAPI(chatHandler, 'POST', {
      message: 'テストメッセージ'
    });

    expect(response.statusCode).toBe(429);
    expect(response.data.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

#### 3.1.3 音声API統合テスト

```typescript
// __tests__/integration/api/voice.test.ts
import voiceRecognizeHandler from '@/pages/api/voice/recognize';
import voiceSynthesizeHandler from '@/pages/api/voice/synthesize';
import { TestEnvironment } from '../setup';

describe('Voice API Integration Tests', () => {
  let testEnv: TestEnvironment;

  beforeEach(() => {
    testEnv = new TestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('/api/voice/recognize', () => {
    test('音声認識の正常フロー', async () => {
      const mockGemini = testEnv.getMock('gemini');
      
      // 音声認識結果のモック
      mockGemini.speechToText.mockResolvedValue('近くの保育園を教えてください');

      // FormDataのモック
      const mockFormData = new FormData();
      const audioBlob = new Blob(['fake audio data'], { type: 'audio/webm' });
      mockFormData.append('audio', audioBlob, 'recording.webm');
      mockFormData.append('language', 'ja');

      const response = await testEnv.callAPI(voiceRecognizeHandler, 'POST', mockFormData);

      expect(response.statusCode).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toMatchObject({
        transcript: '近くの保育園を教えてください',
        confidence: expect.any(Number),
        language: 'ja',
        metadata: expect.objectContaining({
          processingTime: expect.any(Number)
        })
      });
    });

    test('サポートされていないファイル形式', async () => {
      const mockFormData = new FormData();
      const videoBlob = new Blob(['fake video data'], { type: 'video/mp4' });
      mockFormData.append('audio', videoBlob, 'video.mp4');

      const response = await testEnv.callAPI(voiceRecognizeHandler, 'POST', mockFormData);

      expect(response.statusCode).toBe(400);
      expect(response.data.error.code).toBe('VOICE_FORMAT_UNSUPPORTED');
    });

    test('ファイルサイズ超過', async () => {
      const mockFormData = new FormData();
      // 11MBのモックファイル
      const largeBlob = new Blob([new Array(11 * 1024 * 1024).fill('a')], { 
        type: 'audio/webm' 
      });
      mockFormData.append('audio', largeBlob, 'large.webm');

      const response = await testEnv.callAPI(voiceRecognizeHandler, 'POST', mockFormData);

      expect(response.statusCode).toBe(413);
      expect(response.data.error.code).toBe('VOICE_FILE_TOO_LARGE');
    });
  });

  describe('/api/voice/synthesize', () => {
    test('音声合成の正常フロー', async () => {
      const mockGemini = testEnv.getMock('gemini');
      
      // 音声合成結果のモック
      const mockAudioBuffer = Buffer.from('fake audio data');
      mockGemini.textToSpeech.mockResolvedValue(mockAudioBuffer);

      const response = await testEnv.callAPI(voiceSynthesizeHandler, 'POST', {
        text: 'お近くの保育園についてご案内します',
        language: 'ja'
      });

      expect(response.statusCode).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toMatchObject({
        audioUrl: expect.stringMatching(/^\/api\/audio\/cache\/.+\.mp3$/),
        duration: expect.any(Number),
        text: 'お近くの保育園についてご案内します',
        metadata: expect.objectContaining({
          processingTime: expect.any(Number),
          audioFormat: 'mp3'
        })
      });
    });

    test('空のテキスト', async () => {
      const response = await testEnv.callAPI(voiceSynthesizeHandler, 'POST', {
        text: '',
        language: 'ja'
      });

      expect(response.statusCode).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
    });

    test('長すぎるテキスト', async () => {
      const longText = 'あ'.repeat(501);
      
      const response = await testEnv.callAPI(voiceSynthesizeHandler, 'POST', {
        text: longText,
        language: 'ja'
      });

      expect(response.statusCode).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

---

## 4. E2Eテスト設計

### 4.1 E2Eテストフレームワーク

#### 4.1.1 Playwright設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 4.1.2 ページオブジェクトモデル

```typescript
// e2e/pages/ChatPage.ts
import { Page, Locator, expect } from '@playwright/test';

export class ChatPage {
  readonly page: Page;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly voiceButton: Locator;
  readonly messagesContainer: Locator;
  readonly languageSelector: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageInput = page.getByPlaceholder('メッセージを入力してください...');
    this.sendButton = page.getByRole('button', { name: '送信' });
    this.voiceButton = page.getByRole('button', { name: '音声入力' });
    this.messagesContainer = page.getByTestId('messages-container');
    this.languageSelector = page.getByRole('combobox', { name: '言語選択' });
    this.loadingIndicator = page.getByText('回答を生成中...');
  }

  async goto() {
    await this.page.goto('/');
  }

  async sendMessage(message: string) {
    await this.messageInput.fill(message);
    await this.sendButton.click();
  }

  async waitForResponse() {
    await expect(this.loadingIndicator).toBeVisible();
    await expect(this.loadingIndicator).toBeHidden();
  }

  async getLastMessage() {
    const messages = this.messagesContainer.locator('[data-testid="message"]');
    return messages.last();
  }

  async getMessageByIndex(index: number) {
    const messages = this.messagesContainer.locator('[data-testid="message"]');
    return messages.nth(index);
  }

  async switchLanguage(language: 'ja' | 'en') {
    await this.languageSelector.selectOption(language);
  }

  async startVoiceRecording() {
    await this.voiceButton.click();
  }

  async stopVoiceRecording() {
    await this.voiceButton.click();
  }

  async playAudioResponse(messageIndex: number) {
    const message = await this.getMessageByIndex(messageIndex);
    const playButton = message.getByRole('button', { name: '音声再生' });
    await playButton.click();
  }
}
```

### 4.2 E2Eテストシナリオ

#### 4.2.1 基本チャット機能テスト

```typescript
// e2e/chat-basic.spec.ts
import { test, expect } from '@playwright/test';
import { ChatPage } from './pages/ChatPage';

test.describe('基本チャット機能', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.goto();
  });

  test('テキストメッセージの送受信', async () => {
    const userMessage = '近くの保育園を教えてください';
    
    // メッセージ送信
    await chatPage.sendMessage(userMessage);
    
    // ユーザーメッセージの表示確認
    const userMsg = await chatPage.getMessageByIndex(0);
    await expect(userMsg).toContainText(userMessage);
    await expect(userMsg).toHaveAttribute('data-message-type', 'user');
    
    // AI応答の待機・確認
    await chatPage.waitForResponse();
    
    const aiMsg = await chatPage.getMessageByIndex(1);
    await expect(aiMsg).toBeVisible();
    await expect(aiMsg).toHaveAttribute('data-message-type', 'assistant');
    await expect(aiMsg).toContainText(/保育園/);
  });

  test('複数のメッセージ交換', async () => {
    // 1回目の会話
    await chatPage.sendMessage('保育園について教えてください');
    await chatPage.waitForResponse();
    
    // 2回目の会話
    await chatPage.sendMessage('申込み方法を教えてください');
    await chatPage.waitForResponse();
    
    // メッセージ数の確認
    const messages = chatPage.messagesContainer.locator('[data-testid="message"]');
    await expect(messages).toHaveCount(4); // ユーザー2 + AI2
    
    // 会話の文脈が保持されているか確認
    const lastAiMsg = await chatPage.getLastMessage();
    await expect(lastAiMsg).toContainText(/申込み|手続き/);
  });

  test('言語切り替え機能', async () => {
    // 日本語でメッセージ送信
    await chatPage.sendMessage('こんにちは');
    await chatPage.waitForResponse();
    
    let aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/こんにちは|はじめまして/);
    
    // 英語に切り替え
    await chatPage.switchLanguage('en');
    
    // 英語でメッセージ送信
    await chatPage.sendMessage('Hello');
    await chatPage.waitForResponse();
    
    aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/Hello|Hi|Good/);
  });

  test('エラーハンドリング', async () => {
    // 空メッセージ送信試行
    await chatPage.sendButton.click();
    
    // エラーメッセージ確認
    await expect(chatPage.page.getByText('メッセージを入力してください')).toBeVisible();
    
    // 長すぎるメッセージ
    const longMessage = 'あ'.repeat(1001);
    await chatPage.messageInput.fill(longMessage);
    await chatPage.sendButton.click();
    
    await expect(chatPage.page.getByText(/長すぎます/)).toBeVisible();
  });
});
```

#### 4.2.2 音声機能テスト

```typescript
// e2e/voice-functionality.spec.ts
import { test, expect } from '@playwright/test';
import { ChatPage } from './pages/ChatPage';

test.describe('音声機能', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page, context }) => {
    // マイクアクセス許可
    await context.grantPermissions(['microphone']);
    
    chatPage = new ChatPage(page);
    await chatPage.goto();
  });

  test('音声入力の基本フロー', async () => {
    // 音声録音開始
    await chatPage.startVoiceRecording();
    
    // 録音中の表示確認
    await expect(chatPage.page.getByText('録音中...')).toBeVisible();
    
    // 2秒間録音をシミュレート
    await chatPage.page.waitForTimeout(2000);
    
    // 録音停止
    await chatPage.stopVoiceRecording();
    
    // 音声認識処理の待機
    await expect(chatPage.page.getByText('音声を認識中...')).toBeVisible();
    await expect(chatPage.page.getByText('音声を認識中...')).toBeHidden();
    
    // 認識されたテキストがメッセージ入力欄に表示されることを確認
    await expect(chatPage.messageInput).not.toBeEmpty();
    
    // メッセージ送信
    await chatPage.sendButton.click();
    await chatPage.waitForResponse();
    
    // 応答が返ってくることを確認
    const aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toBeVisible();
  });

  test('音声出力機能', async () => {
    // テキストメッセージを送信
    await chatPage.sendMessage('保育園について教えてください');
    await chatPage.waitForResponse();
    
    // AI応答メッセージに音声再生ボタンがあることを確認
    const aiMsg = await chatPage.getLastMessage();
    const playButton = aiMsg.getByRole('button', { name: '音声再生' });
    await expect(playButton).toBeVisible();
    
    // 音声再生
    await playButton.click();
    
    // 再生中の表示確認
    await expect(aiMsg.getByText('再生中...')).toBeVisible();
    
    // 再生完了まで待機
    await expect(aiMsg.getByText('再生中...')).toBeHidden({ timeout: 10000 });
  });

  test('マイクアクセス拒否時のエラーハンドリング', async ({ page, context }) => {
    // マイクアクセス拒否
    await context.grantPermissions([]);
    
    await chatPage.goto();
    
    // 音声録音試行
    await chatPage.startVoiceRecording();
    
    // エラーメッセージ確認
    await expect(page.getByText('マイクへのアクセスが拒否されました')).toBeVisible();
  });
});
```

#### 4.2.3 ユーザーシナリオテスト

```typescript
// e2e/user-scenarios.spec.ts
import { test, expect } from '@playwright/test';
import { ChatPage } from './pages/ChatPage';

test.describe('ユーザーシナリオ', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.goto();
  });

  test('育児支援制度の相談シナリオ', async () => {
    // ステップ1: 初回質問
    await chatPage.sendMessage('子育て支援制度について知りたいです');
    await chatPage.waitForResponse();
    
    let aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/支援制度|児童手当|保育/);
    
    // ステップ2: 具体的な制度について質問
    await chatPage.sendMessage('児童手当の金額はいくらですか？');
    await chatPage.waitForResponse();
    
    aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/児童手当|金額|円/);
    
    // ステップ3: 申請方法について質問
    await chatPage.sendMessage('どこで申請できますか？');
    await chatPage.waitForResponse();
    
    aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/申請|市区町村|窓口/);
  });

  test('保育園探しのシナリオ', async () => {
    // ステップ1: 保育園について質問
    await chatPage.sendMessage('3歳の子供の保育園を探しています');
    await chatPage.waitForResponse();
    
    let aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/保育園|認可|申込み/);
    
    // ステップ2: 申込み時期について質問
    await chatPage.sendMessage('いつから申込みできますか？');
    await chatPage.waitForResponse();
    
    aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/申込み|時期|締切/);
    
    // ステップ3: 必要書類について質問
    await chatPage.sendMessage('必要な書類は何ですか？');
    await chatPage.waitForResponse();
    
    aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/書類|必要|申請書/);
  });

  test('外国人住民の利用シナリオ', async () => {
    // 英語に切り替え
    await chatPage.switchLanguage('en');
    
    // ステップ1: 英語で質問
    await chatPage.sendMessage('I need information about childcare support');
    await chatPage.waitForResponse();
    
    let aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/childcare|support|information/i);
    
    // ステップ2: 具体的なサービスについて質問
    await chatPage.sendMessage('What kind of financial support is available?');
    await chatPage.waitForResponse();
    
    aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/financial|support|allowance/i);
  });

  test('セッション継続性のテスト', async () => {
    // 複数の質問で文脈が保持されることを確認
    await chatPage.sendMessage('2歳の子供がいます');
    await chatPage.waitForResponse();
    
    await chatPage.sendMessage('利用できる支援制度はありますか？');
    await chatPage.waitForResponse();
    
    let aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/2歳|支援制度/);
    
    // 代名詞で質問して文脈理解を確認
    await chatPage.sendMessage('それはいくらもらえますか？');
    await chatPage.waitForResponse();
    
    aiMsg = await chatPage.getLastMessage();
    await expect(aiMsg).toContainText(/金額|円|支給/);
  });
});
```

---

## 5. パフォーマンステスト設計

### 5.1 負荷テスト

#### 5.1.1 K6負荷テストスクリプト

```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const chatApiSuccessRate = new Rate('chat_api_success');

// テスト設定
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // 10ユーザーまで増加
    { duration: '5m', target: 10 },   // 10ユーザーで5分間維持
    { duration: '2m', target: 50 },   // 50ユーザーまで増加
    { duration: '5m', target: 50 },   // 50ユーザーで5分間維持
    { duration: '2m', target: 100 },  // 100ユーザーまで増加
    { duration: '5m', target: 100 },  // 100ユーザーで5分間維持
    { duration: '5m', target: 0 },    // 0まで減少
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95%のリクエストが3秒以内
    http_req_failed: ['rate<0.01'],    // エラー率1%未満
    errors: ['rate<0.01'],             // エラー率1%未満
    chat_api_success: ['rate>0.95'],   // チャットAPI成功率95%以上
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// テストメッセージ
const testMessages = [
  '近くの保育園を教えてください',
  '児童手当について教えてください',
  '子育て支援制度はありますか？',
  '保育園の申込み方法を教えてください',
  '学童保育について知りたいです',
  '子ども医療費助成制度について教えてください'
];

export function setup() {
  // セットアップフェーズ
  console.log('Starting load test...');
  return {};
}

export default function() {
  // セッション作成
  let sessionResponse = http.post(`${BASE_URL}/api/session`, 
    JSON.stringify({ language: 'ja' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'session_create' }
    }
  );
  
  let sessionCheck = check(sessionResponse, {
    'session created successfully': (r) => r.status === 200,
    'session response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  if (!sessionCheck) {
    errorRate.add(1);
    return;
  }
  
  const sessionData = JSON.parse(sessionResponse.body);
  const sessionId = sessionData.data.sessionId;
  
  // チャットメッセージ送信
  const message = testMessages[Math.floor(Math.random() * testMessages.length)];
  
  let chatResponse = http.post(`${BASE_URL}/api/chat`,
    JSON.stringify({
      message: message,
      sessionId: sessionId,
      language: 'ja'
    }),
    {
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId
      },
      tags: { name: 'chat_message' }
    }
  );
  
  let chatCheck = check(chatResponse, {
    'chat response status is 200': (r) => r.status === 200,
    'chat response time < 5s': (r) => r.timings.duration < 5000,
    'chat response has content': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data && body.data.content;
      } catch (e) {
        return false;
      }
    },
  });
  
  chatApiSuccessRate.add(chatCheck);
  
  if (!chatCheck) {
    errorRate.add(1);
  }
  
  // セッション削除
  http.del(`${BASE_URL}/api/session/${sessionId}`, null, {
    headers: { 'X-Session-ID': sessionId },
    tags: { name: 'session_delete' }
  });
  
  // リクエスト間隔
  sleep(Math.random() * 3 + 1); // 1-4秒のランダム間隔
}

export function teardown(data) {
  console.log('Load test completed');
}
```

#### 5.1.2 音声API負荷テスト

```javascript
// k6/voice-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// 音声ファイルデータ（Base64）
const audioData = new SharedArray('audioFiles', function() {
  return [
    // 実際のテストでは音声ファイルをBase64エンコードして使用
    'UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=', // 短い音声サンプル
  ];
});

export const options = {
  stages: [
    { duration: '1m', target: 5 },   // 5ユーザー
    { duration: '3m', target: 5 },   // 5ユーザーで3分維持
    { duration: '1m', target: 20 },  // 20ユーザーまで増加
    { duration: '5m', target: 20 },  // 20ユーザーで5分維持
    { duration: '2m', target: 0 },   // 減少
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'], // 音声処理は10秒以内
    http_req_failed: ['rate<0.05'],     // エラー率5%未満
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  // 音声認識テスト
  const formData = {
    audio: http.file(Buffer.from(audioData[0], 'base64'), 'test.wav', 'audio/wav'),
    language: 'ja'
  };
  
  let voiceResponse = http.post(`${BASE_URL}/api/voice/recognize`, formData, {
    tags: { name: 'voice_recognize' }
  });
  
  check(voiceResponse, {
    'voice recognition status is 200': (r) => r.status === 200,
    'voice recognition time < 10s': (r) => r.timings.duration < 10000,
    'voice recognition has transcript': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data && body.data.transcript;
      } catch (e) {
        return false;
      }
    },
  });
  
  sleep(2);
  
  // 音声合成テスト
  let synthesisResponse = http.post(`${BASE_URL}/api/voice/synthesize`,
    JSON.stringify({
      text: 'テスト用の音声合成です',
      language: 'ja'
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'voice_synthesize' }
    }
  );
  
  check(synthesisResponse, {
    'voice synthesis status is 200': (r) => r.status === 200,
    'voice synthesis time < 8s': (r) => r.timings.duration < 8000,
    'voice synthesis has audio URL': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data && body.data.audioUrl;
      } catch (e) {
        return false;
      }
    },
  });
  
  sleep(Math.random() * 2 + 1);
}
```

### 5.2 ストレステスト

#### 5.2.1 スパイクテスト

```javascript
// k6/spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // 通常負荷
    { duration: '1m', target: 10 },    // 通常負荷維持
    { duration: '10s', target: 200 },  // 急激なスパイク
    { duration: '30s', target: 200 },  // スパイク維持
    { duration: '10s', target: 10 },   // 通常負荷に戻る
    { duration: '1m', target: 10 },    // 通常負荷維持
    { duration: '10s', target: 0 },    // 終了
  ],
  thresholds: {
    http_req_duration: ['p(99)<10000'], // 99%が10秒以内
    http_req_failed: ['rate<0.1'],      // エラー率10%未満
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  // ヘルスチェックエンドポイントで基本的な応答性をテスト
  let response = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health_check' }
  });
  
  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  sleep(0.1); // 高負荷を維持
}
```

---

## 6. セキュリティテスト設計

### 6.1 脆弱性テスト

#### 6.1.1 入力検証テスト

```typescript
// __tests__/security/input-validation.test.ts
import { test, expect } from '@playwright/test';

test.describe('セキュリティ: 入力検証', () => {
  test('XSSペイロードの検証', async ({ page }) => {
    await page.goto('/');
    
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(document.cookie)',
      '<svg onload="alert(1)">',
      '"><script>alert(String.fromCharCode(88,83,83))</script>'
    ];
    
    for (const payload of xssPayloads) {
      // XSSペイロードを送信
      await page.getByPlaceholder('メッセージを入力してください...').fill(payload);
      await page.getByRole('button', { name: '送信' }).click();
      
      // スクリプトが実行されないことを確認
      await expect(page.locator('body')).not.toContainText('XSS');
      
      // エラーメッセージが表示されることを確認
      await expect(page.getByText(/不正な入力|無効な文字/)).toBeVisible();
    }
  });

  test('SQLインジェクション対策', async ({ request }) => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM information_schema.tables --",
      "'; EXEC xp_cmdshell('dir'); --"
    ];
    
    for (const payload of sqlPayloads) {
      const response = await request.post('/api/chat', {
        data: {
          message: payload,
          language: 'ja'
        }
      });
      
      // 正常なエラーレスポンスまたは適切な処理
      expect([200, 400, 422]).toContain(response.status());
      
      // SQLエラーが露出していないことを確認
      const body = await response.text();
      expect(body).not.toMatch(/SQL|database|table|column/i);
    }
  });

  test('コマンドインジェクション対策', async ({ request }) => {
    const commandPayloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '&& whoami',
      '`id`',
      '$(pwd)'
    ];
    
    for (const payload of commandPayloads) {
      const response = await request.post('/api/voice/synthesize', {
        data: {
          text: payload,
          language: 'ja'
        }
      });
      
      expect([200, 400, 422]).toContain(response.status());
      
      const body = await response.text();
      expect(body).not.toMatch(/root|admin|uid|gid/i);
    }
  });
});
```

#### 6.1.2 認証・認可テスト

```typescript
// __tests__/security/auth-authz.test.ts
import { test, expect } from '@playwright/test';

test.describe('セキュリティ: 認証・認可', () => {
  test('無効なセッションIDでのアクセス', async ({ request }) => {
    const invalidSessionIds = [
      'invalid-session',
      '../../etc/passwd',
      '<script>alert("xss")</script>',
      'null',
      '0',
      'undefined'
    ];
    
    for (const sessionId of invalidSessionIds) {
      const response = await request.post('/api/chat', {
        headers: {
          'X-Session-ID': sessionId
        },
        data: {
          message: 'test',
          sessionId: sessionId
        }
      });
      
      expect([400, 401, 404]).toContain(response.status());
    }
  });

  test('レート制限のテスト', async ({ request }) => {
    // 同一セッションから大量リクエスト
    const sessionResponse = await request.post('/api/session', {
      data: { language: 'ja' }
    });
    
    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.data.sessionId;
    
    // 制限を超えるリクエストを送信
    const promises = [];
    for (let i = 0; i < 70; i++) { // 制限は60回/分
      promises.push(
        request.post('/api/chat', {
          headers: { 'X-Session-ID': sessionId },
          data: {
            message: `test message ${i}`,
            sessionId: sessionId
          }
        })
      );
    }
    
    const responses = await Promise.all(promises);
    
    // 一部のリクエストが429 (Too Many Requests) になることを確認
    const rateLimitedResponses = responses.filter(r => r.status() === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });

  test('CORS設定の検証', async ({ request }) => {
    // 不正なOriginからのリクエスト
    const response = await request.post('/api/chat', {
      headers: {
        'Origin': 'https://malicious-site.com'
      },
      data: {
        message: 'test'
      }
    });
    
    // CORSエラーまたは適切な拒否
    expect([400, 403, 404]).toContain(response.status());
  });
});
```

### 6.2 OWASP ZAP自動スキャン

#### 6.2.1 セキュリティスキャン設定

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  schedule:
    - cron: '0 2 * * *'  # 毎日午前2時
  workflow_dispatch:

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Start application
        run: |
          docker-compose up -d
          sleep 30
      
      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
      
      - name: ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
      
      - name: Upload ZAP reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: zap-reports
          path: |
            report_html.html
            report_json.json
```

---

## 7. テスト実行・CI/CD統合

### 7.1 GitHub Actions統合

#### 7.1.1 テストワークフロー

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          REDIS_URL: redis://localhost:6379
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY_TEST }}

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start application
        run: |
          npm run build
          npm run start &
          sleep 10
        env:
          NODE_ENV: test
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload E2E reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install K6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Start application
        run: |
          npm ci
          npm run build
          npm run start &
          sleep 15
        env:
          NODE_ENV: production
      
      - name: Run performance tests
        run: k6 run k6/load-test.js
        env:
          BASE_URL: http://localhost:3000
      
      - name: Upload performance reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-results
          path: k6-results.json
```

### 7.2 テストレポート

#### 7.2.1 Jest設定

```javascript
// jest.config.js
module.exports = {
  preset: 'next/jest',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
};
```

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "design-docs-creation", "content": "MVP\u7bc4\u56f2\u3067\u306e\u8a2d\u8a08\u66f8\u4e00\u5f0f\u3092\u4f5c\u6210\u3059\u308b", "status": "completed", "priority": "high"}, {"id": "detailed-design", "content": "\u8a73\u7d30\u8a2d\u8a08\u66f8\u3092\u4f5c\u6210\u3059\u308b", "status": "completed", "priority": "high"}, {"id": "database-design", "content": "\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u8a2d\u8a08\u66f8\u3092\u4f5c\u6210\u3059\u308b", "status": "completed", "priority": "high"}, {"id": "api-design", "content": "API\u8a2d\u8a08\u66f8\u3092\u4f5c\u6210\u3059\u308b", "status": "completed", "priority": "high"}, {"id": "security-design", "content": "\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u8a2d\u8a08\u66f8\u3092\u4f5c\u6210\u3059\u308b", "status": "completed", "priority": "medium"}, {"id": "deployment-design", "content": "\u904b\u7528\u30fb\u30c7\u30d7\u30ed\u30a4\u8a2d\u8a08\u66f8\u3092\u4f5c\u6210\u3059\u308b", "status": "completed", "priority": "medium"}, {"id": "test-design", "content": "\u30c6\u30b9\u30c8\u8a2d\u8a08\u66f8\u3092\u4f5c\u6210\u3059\u308b", "status": "completed", "priority": "medium"}]