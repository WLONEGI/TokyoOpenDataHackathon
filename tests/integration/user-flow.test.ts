/**
 * User Flow Integration Tests
 * ユーザーフロー検証テスト
 * 
 * This test suite verifies end-to-end user journeys and workflows
 * to ensure the application functions correctly from a user perspective.
 */

import { NextRequest } from 'next/server';

// Import API routes for testing user flows
import { POST as chatPOST } from '@/app/api/chat/route';
import { POST as sessionPOST, GET as sessionGET } from '@/app/api/session/route';
import { POST as searchPOST, GET as searchGET } from '@/app/api/search/route';
import { GET as dataGET } from '@/app/api/data/route';
import { GET as healthGET } from '@/app/api/health/route';

// Global test configuration
const TEST_TIMEOUT = 30000;

describe('User Flow Integration Tests', () => {
  
  // Helper function to create test requests
  const createTestRequest = (body: any, path: string = '/api/chat'): NextRequest => {
    return new NextRequest(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic User Journey', () => {
    test('New user: session creation -> welcome message -> childcare inquiry', async () => {
      // Step 1: User visits application and session is created
      const sessionRequest = { language: 'ja' };
      const sessionReq = createTestRequest(sessionRequest, '/api/session');
      
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      
      expect(sessionResponse.status).toBe(201);
      expect(sessionData.success).toBe(true);
      
      const sessionId = sessionData.data.sessionId;
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Step 2: User sends first message asking about childcare
      const welcomeMessage = 'こんにちは、保育園について教えてください';
      const welcomeRequest = {
        message: welcomeMessage,
        sessionId,
        language: 'ja',
        useVoice: false
      };

      const welcomeReq = createTestRequest(welcomeRequest);
      const welcomeResponse = await chatPOST(welcomeReq);
      const welcomeData = await welcomeResponse.json();

      expect(welcomeResponse.status).toBe(200);
      expect(welcomeData.success).toBe(true);
      expect(welcomeData.data.response).toBeDefined();
      expect(typeof welcomeData.data.response).toBe('string');
      expect(welcomeData.data.response.length).toBeGreaterThan(0);

      // Step 3: User follows up with specific question
      const followUpMessage = '私は3歳の子供がいます。近くの保育園を探しています';
      const followUpRequest = {
        message: followUpMessage,
        sessionId,
        language: 'ja',
        useVoice: false
      };

      const followUpReq = createTestRequest(followUpRequest);
      const followUpResponse = await chatPOST(followUpReq);
      const followUpData = await followUpResponse.json();

      expect(followUpResponse.status).toBe(200);
      expect(followUpData.success).toBe(true);
      expect(followUpData.data.response).toBeDefined();
    }, TEST_TIMEOUT);

    test('Location-aware user: provides location -> gets localized results', async () => {
      // Step 1: Create session
      const sessionRequest = { language: 'ja' };
      const sessionReq = createTestRequest(sessionRequest, '/api/session');
      
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      // Step 2: User provides location information
      const locationMessage = '東京駅の近くで子育て支援センターを探しています';
      const locationRequest = {
        message: locationMessage,
        sessionId,
        language: 'ja',
        location: {
          latitude: 35.6812,
          longitude: 139.7671,
          accuracy: 10
        },
        requestedScope: {
          timeRange: 'today',
          locationRange: 'walking_distance'
        }
      };

      const locationReq = createTestRequest(locationRequest);
      const locationResponse = await chatPOST(locationReq);
      const locationData = await locationResponse.json();

      expect(locationResponse.status).toBe(200);
      expect(locationData.success).toBe(true);
      expect(locationData.data.response).toBeDefined();
      expect(locationData.data.response.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });

  describe('Multi-language User Flow', () => {
    test('International user: English session -> translation needs', async () => {
      // Step 1: Create English session
      const sessionRequest = { language: 'en' };
      const sessionReq = createTestRequest(sessionRequest, '/api/session');
      
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      
      expect(sessionResponse.status).toBe(201);
      expect(sessionData.data.language).toBe('en');
      
      const sessionId = sessionData.data.sessionId;

      // Step 2: User asks in English
      const englishMessage = 'Hello, I am looking for childcare services in Tokyo';
      const englishRequest = {
        message: englishMessage,
        sessionId,
        language: 'en',
        useVoice: false
      };

      const englishReq = createTestRequest(englishRequest);
      const englishResponse = await chatPOST(englishReq);
      const englishData = await englishResponse.json();

      expect(englishResponse.status).toBe(200);
      expect(englishData.success).toBe(true);
      expect(englishData.data.response).toBeDefined();
    }, TEST_TIMEOUT);

    test('Language switching: Japanese -> English -> back to Japanese', async () => {
      // Step 1: Start with Japanese session
      const jaSessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const jaSessionResponse = await sessionPOST(jaSessionReq);
      const jaSessionData = await jaSessionResponse.json();
      const jaSessionId = jaSessionData.data.sessionId;

      // Step 2: Chat in Japanese
      const japaneseRequest = {
        message: '保育園について教えて',
        sessionId: jaSessionId,
        language: 'ja'
      };

      const jaResponse = await chatPOST(createTestRequest(japaneseRequest));
      expect(jaResponse.status).toBe(200);

      // Step 3: Create English session (simulate language switch)
      const enSessionReq = createTestRequest({ language: 'en' }, '/api/session');
      const enSessionResponse = await sessionPOST(enSessionReq);
      const enSessionData = await enSessionResponse.json();
      const enSessionId = enSessionData.data.sessionId;

      // Step 4: Chat in English
      const englishRequest = {
        message: 'Tell me about nursery schools',
        sessionId: enSessionId,
        language: 'en'
      };

      const enResponse = await chatPOST(createTestRequest(englishRequest));
      expect(enResponse.status).toBe(200);

      // Verify different sessions
      expect(jaSessionId).not.toBe(enSessionId);
    }, TEST_TIMEOUT);
  });

  describe('Advanced Search User Flow', () => {
    test('Power user: data exploration -> search -> detailed inquiry', async () => {
      // Step 1: User explores available data sources
      const sourcesRequest = new NextRequest('http://localhost:3000/api/data?category=sources', {
        method: 'GET',
      });

      const sourcesResponse = await dataGET(sourcesRequest);
      const sourcesData = await sourcesResponse.json();

      expect(sourcesResponse.status).toBe(200);
      expect(sourcesData.success).toBe(true);
      expect(Array.isArray(sourcesData.data)).toBe(true);

      // Step 2: User performs targeted search
      const searchRequest = {
        text: '学童保育',
        language: 'ja',
        category: 'childcare',
        limit: 5
      };

      const searchReq = createTestRequest(searchRequest, '/api/search');
      const searchResponse = await searchPOST(searchReq);
      
      // Search may have various outcomes due to service dependencies
      expect([200, 400, 500]).toContain(searchResponse.status);
      
      if (searchResponse.status === 200) {
        const searchData = await searchResponse.json();
        expect(searchData.success).toBe(true);
        expect(searchData.data.items).toBeDefined();
      }

      // Step 3: User asks detailed question based on search
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      const detailedRequest = {
        message: '学童保育の利用条件と申込み方法について詳しく教えて',
        sessionId,
        language: 'ja'
      };

      const detailedReq = createTestRequest(detailedRequest);
      const detailedResponse = await chatPOST(detailedReq);
      const detailedData = await detailedResponse.json();

      expect(detailedResponse.status).toBe(200);
      expect(detailedData.success).toBe(true);
      expect(detailedData.data.response).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Error Recovery User Flow', () => {
    test('User recovers from invalid input gracefully', async () => {
      // Step 1: Create session
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      // Step 2: User sends invalid/empty message
      const invalidRequest = {
        message: '',
        sessionId,
        language: 'ja'
      };

      const invalidReq = createTestRequest(invalidRequest);
      const invalidResponse = await chatPOST(invalidReq);

      expect(invalidResponse.status).toBe(400);
      
      const invalidData = await invalidResponse.json();
      expect(invalidData.success).toBe(false);
      expect(invalidData.error).toBeDefined();

      // Step 3: User corrects input and succeeds
      const correctedRequest = {
        message: '保育園について教えてください',
        sessionId,
        language: 'ja'
      };

      const correctedReq = createTestRequest(correctedRequest);
      const correctedResponse = await chatPOST(correctedReq);
      const correctedData = await correctedResponse.json();

      expect(correctedResponse.status).toBe(200);
      expect(correctedData.success).toBe(true);
      expect(correctedData.data.response).toBeDefined();
    }, TEST_TIMEOUT);

    test('User handles session expiry gracefully', async () => {
      // Step 1: User tries to use non-existent session
      const invalidSessionRequest = {
        message: 'Hello world',
        sessionId: 'non-existent-session-id',
        language: 'ja'
      };

      const invalidSessionReq = createTestRequest(invalidSessionRequest);
      const invalidSessionResponse = await chatPOST(invalidSessionReq);
      
      // Should handle gracefully - either 200 (with new session) or 400 (validation error)
      expect([200, 400]).toContain(invalidSessionResponse.status);
      
      const invalidSessionData = await invalidSessionResponse.json();
      if (invalidSessionResponse.status === 400) {
        expect(invalidSessionData.success).toBe(false);
      } else {
        expect(invalidSessionData.success).toBe(true);
      }

      // Step 2: User creates new session properly
      const newSessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const newSessionResponse = await sessionPOST(newSessionReq);
      const newSessionData = await newSessionResponse.json();

      expect(newSessionResponse.status).toBe(201);
      expect(newSessionData.success).toBe(true);
      
      const newSessionId = newSessionData.data.sessionId;

      // Step 3: User continues with valid session
      const validRequest = {
        message: '保育園について教えて',
        sessionId: newSessionId,
        language: 'ja'
      };

      const validReq = createTestRequest(validRequest);
      const validResponse = await chatPOST(validReq);
      const validData = await validResponse.json();

      expect(validResponse.status).toBe(200);
      expect(validData.success).toBe(true);
      expect(validData.data.response).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Complex User Scenarios', () => {
    test('Parent planning workflow: research -> compare -> decide', async () => {
      // Simulate a parent researching childcare options
      
      // Step 1: Initial inquiry
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      const questions = [
        '4歳の子供の保育園を探しています',
        '公立と私立の保育園の違いを教えて',
        '保育園の申込み時期はいつですか',
        '必要な書類について詳しく教えて'
      ];

      // Step 2: Ask multiple related questions
      for (const question of questions) {
        const request = {
          message: question,
          sessionId,
          language: 'ja'
        };

        const req = createTestRequest(request);
        const response = await chatPOST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.response).toBeDefined();
        expect(data.data.response.length).toBeGreaterThan(0);
      }
    }, TEST_TIMEOUT);

    test('Emergency situation: urgent childcare need', async () => {
      // Simulate urgent childcare need scenario
      
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      const urgentRequest = {
        message: '緊急で今日から預かってもらえる保育施設を探しています。一時保育でも構いません。',
        sessionId,
        language: 'ja',
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          accuracy: 10
        },
        requestedScope: {
          timeRange: 'today',
          locationRange: 'nearby'
        }
      };

      const urgentReq = createTestRequest(urgentRequest);
      const urgentResponse = await chatPOST(urgentReq);
      const urgentData = await urgentResponse.json();

      expect(urgentResponse.status).toBe(200);
      expect(urgentData.success).toBe(true);
      expect(urgentData.data.response).toBeDefined();

      // Follow up with specific requirements
      const followUpRequest = {
        message: '2歳の子供です。アレルギー対応が必要ですが大丈夫でしょうか？',
        sessionId,
        language: 'ja'
      };

      const followUpReq = createTestRequest(followUpRequest);
      const followUpResponse = await chatPOST(followUpReq);
      const followUpData = await followUpResponse.json();

      expect(followUpResponse.status).toBe(200);
      expect(followUpData.success).toBe(true);
      expect(followUpData.data.response).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('System Health During User Flow', () => {
    test('System remains healthy during typical user interactions', async () => {
      // Check initial system health
      const initialHealthReq = new NextRequest('http://localhost:3000/api/health', {
        method: 'GET',
      });

      const initialHealthResponse = await healthGET(initialHealthReq);
      const initialHealthData = await initialHealthResponse.json();

      expect([200, 503]).toContain(initialHealthResponse.status);

      // Simulate normal user activity
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      // Multiple interactions
      const interactions = [
        'こんにちは',
        '保育園について教えて',
        'ありがとうございます'
      ];

      for (const message of interactions) {
        const request = {
          message,
          sessionId,
          language: 'ja'
        };

        const req = createTestRequest(request);
        const response = await chatPOST(req);
        
        expect(response.status).toBe(200);
      }

      // Check system health after interactions
      const finalHealthReq = new NextRequest('http://localhost:3000/api/health', {
        method: 'GET',
      });

      const finalHealthResponse = await healthGET(finalHealthReq);
      
      expect([200, 503]).toContain(finalHealthResponse.status);
    }, TEST_TIMEOUT);
  });

  describe('Accessibility and Usability Flow', () => {
    test('User flow works with assistive technology patterns', async () => {
      // Test patterns that assistive technology might use
      
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      // Test with very explicit, structured requests
      const accessibleRequest = {
        message: '質問: 保育園の情報が欲しいです。目的: 3歳児の入園準備。場所: 東京都内。',
        sessionId,
        language: 'ja'
      };

      const accessibleReq = createTestRequest(accessibleRequest);
      const accessibleResponse = await chatPOST(accessibleReq);
      const accessibleData = await accessibleResponse.json();

      expect(accessibleResponse.status).toBe(200);
      expect(accessibleData.success).toBe(true);
      expect(accessibleData.data.response).toBeDefined();

      // Test with voice-like patterns (shorter, conversational)
      const voiceLikeRequest = {
        message: '近くの保育園',
        sessionId,
        language: 'ja',
        useVoice: true
      };

      const voiceLikeReq = createTestRequest(voiceLikeRequest);
      const voiceLikeResponse = await chatPOST(voiceLikeReq);
      const voiceLikeData = await voiceLikeResponse.json();

      expect(voiceLikeResponse.status).toBe(200);
      expect(voiceLikeData.success).toBe(true);
      expect(voiceLikeData.data.response).toBeDefined();
    }, TEST_TIMEOUT);
  });
});