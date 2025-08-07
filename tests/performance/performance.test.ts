/**
 * Performance Tests
 * パフォーマンステスト
 * 
 * This test suite evaluates the performance characteristics of the application
 * including response times, throughput, memory usage, and scalability.
 */

import { NextRequest } from 'next/server';

// Import API routes for performance testing
import { POST as chatPOST } from '@/app/api/chat/route';
import { POST as sessionPOST, GET as sessionGET } from '@/app/api/session/route';
import { POST as searchPOST, GET as searchGET } from '@/app/api/search/route';
import { GET as dataGET } from '@/app/api/data/route';
import { GET as healthGET } from '@/app/api/health/route';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  sessionCreation: 2000, // 2 seconds
  chatResponse: 15000, // 15 seconds
  searchResponse: 10000, // 10 seconds
  dataRetrieval: 5000, // 5 seconds
  healthCheck: 3000, // 3 seconds
  concurrentRequests: 5, // Number of concurrent requests
  memoryLeakThreshold: 100 * 1024 * 1024, // 100MB
};

// Global test configuration
const TEST_TIMEOUT = 60000; // 1 minute

describe('Performance Tests', () => {
  
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

  // Helper function to measure execution time
  const measureExecutionTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    return { result, duration };
  };

  // Helper function to measure memory usage
  const measureMemoryUsage = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Force garbage collection if available
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  describe('API Response Time Performance', () => {
    test('Session creation should complete within threshold', async () => {
      const sessionRequest = { language: 'ja' };
      const request = createTestRequest(sessionRequest, '/api/session');

      const { result: response, duration } = await measureExecutionTime(async () => {
        return await sessionPOST(request);
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.sessionCreation);

      console.log(`Session creation time: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.sessionCreation}ms)`);
    }, TEST_TIMEOUT);

    test('Chat response should complete within threshold', async () => {
      // Create session first
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      // Test chat performance
      const chatRequest = {
        message: 'Simple test message for performance',
        sessionId,
        language: 'ja',
        useVoice: false
      };

      const request = createTestRequest(chatRequest);

      const { result: response, duration } = await measureExecutionTime(async () => {
        return await chatPOST(request);
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.chatResponse);

      console.log(`Chat response time: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.chatResponse}ms)`);
    }, TEST_TIMEOUT);

    test('Search response should complete within threshold', async () => {
      const searchRequest = {
        text: '保育園',
        language: 'ja',
        limit: 5
      };

      const request = createTestRequest(searchRequest, '/api/search');

      const { result: response, duration } = await measureExecutionTime(async () => {
        return await searchPOST(request);
      });

      // Accept various status codes due to service dependencies
      expect([200, 400, 500]).toContain(response.status);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.searchResponse);

      console.log(`Search response time: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.searchResponse}ms)`);
    }, TEST_TIMEOUT);

    test('Data retrieval should complete within threshold', async () => {
      const request = new NextRequest('http://localhost:3000/api/data?category=sources', {
        method: 'GET',
      });

      const { result: response, duration } = await measureExecutionTime(async () => {
        return await dataGET(request);
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.dataRetrieval);

      console.log(`Data retrieval time: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.dataRetrieval}ms)`);
    }, TEST_TIMEOUT);

    test('Health check should complete within threshold', async () => {
      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'GET',
      });

      const { result: response, duration } = await measureExecutionTime(async () => {
        return await healthGET(request);
      });

      expect([200, 503]).toContain(response.status);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.healthCheck);

      console.log(`Health check time: ${duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.healthCheck}ms)`);
    }, TEST_TIMEOUT);
  });

  describe('Concurrent Request Performance', () => {
    test('Multiple session creations should handle concurrency', async () => {
      const sessionRequests = Array(PERFORMANCE_THRESHOLDS.concurrentRequests)
        .fill(null)
        .map(() => createTestRequest({ language: 'ja' }, '/api/session'));

      const { result: responses, duration } = await measureExecutionTime(async () => {
        return await Promise.all(sessionRequests.map(req => sessionPOST(req)));
      });

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
      }

      // Concurrent execution should not be significantly slower than sequential
      const expectedMaxTime = PERFORMANCE_THRESHOLDS.sessionCreation * 2; // Allow 2x time for concurrency
      expect(duration).toBeLessThan(expectedMaxTime);

      console.log(`Concurrent session creation time: ${duration}ms for ${PERFORMANCE_THRESHOLDS.concurrentRequests} requests`);
    }, TEST_TIMEOUT);

    test('Multiple data requests should handle concurrency', async () => {
      const dataRequests = Array(PERFORMANCE_THRESHOLDS.concurrentRequests)
        .fill(null)
        .map(() => new NextRequest('http://localhost:3000/api/data?category=sources', { method: 'GET' }));

      const { result: responses, duration } = await measureExecutionTime(async () => {
        return await Promise.all(dataRequests.map(req => dataGET(req)));
      });

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      }

      // Concurrent execution should not be significantly slower
      const expectedMaxTime = PERFORMANCE_THRESHOLDS.dataRetrieval * 2;
      expect(duration).toBeLessThan(expectedMaxTime);

      console.log(`Concurrent data request time: ${duration}ms for ${PERFORMANCE_THRESHOLDS.concurrentRequests} requests`);
    }, TEST_TIMEOUT);
  });

  describe('Memory Usage Performance', () => {
    test('Session creation should not cause memory leaks', async () => {
      const initialMemory = measureMemoryUsage();
      
      // Create multiple sessions
      const sessionPromises = Array(10).fill(null).map(async () => {
        const request = createTestRequest({ language: 'ja' }, '/api/session');
        const response = await sessionPOST(request);
        return response.json();
      });

      await Promise.all(sessionPromises);

      // Force garbage collection if available
      if (typeof global.gc === 'function') {
        global.gc();
      }

      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold);

      console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }, TEST_TIMEOUT);

    test('Multiple API calls should not cause excessive memory growth', async () => {
      const initialMemory = measureMemoryUsage();
      
      // Mix of different API calls
      const apiCalls = [];
      
      for (let i = 0; i < 5; i++) {
        // Session creation
        apiCalls.push(sessionPOST(createTestRequest({ language: 'ja' }, '/api/session')));
        
        // Data retrieval
        apiCalls.push(dataGET(new NextRequest('http://localhost:3000/api/data?category=sources', { method: 'GET' })));
        
        // Health check
        apiCalls.push(healthGET(new NextRequest('http://localhost:3000/api/health', { method: 'GET' })));
      }

      await Promise.allSettled(apiCalls);

      // Force garbage collection
      if (typeof global.gc === 'function') {
        global.gc();
      }

      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold);

      console.log(`Memory usage after mixed API calls: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }, TEST_TIMEOUT);
  });

  describe('Throughput Performance', () => {
    test('System should handle sequential requests efficiently', async () => {
      const numberOfRequests = 10;
      const requests = [];

      const startTime = Date.now();

      for (let i = 0; i < numberOfRequests; i++) {
        const request = createTestRequest({ language: 'ja' }, '/api/session');
        requests.push(sessionPOST(request));
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Calculate throughput (requests per second)
      const throughput = (numberOfRequests / totalTime) * 1000;

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(201);
      }

      // Should achieve reasonable throughput
      expect(throughput).toBeGreaterThan(1); // At least 1 request per second

      console.log(`Throughput: ${throughput.toFixed(2)} requests/second (${numberOfRequests} requests in ${totalTime}ms)`);
    }, TEST_TIMEOUT);
  });

  describe('Resource Cleanup Performance', () => {
    test('API endpoints should properly clean up resources', async () => {
      const initialMemory = measureMemoryUsage();
      
      // Create a session and perform chat
      const sessionReq = createTestRequest({ language: 'ja' }, '/api/session');
      const sessionResponse = await sessionPOST(sessionReq);
      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.data.sessionId;

      // Perform a chat operation
      const chatRequest = {
        message: 'Resource cleanup test',
        sessionId,
        language: 'ja'
      };

      const chatReq = createTestRequest(chatRequest);
      await chatPOST(chatReq);

      // Force cleanup
      if (typeof global.gc === 'function') {
        global.gc();
      }

      // Wait a bit for async cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold);

      console.log(`Resource cleanup test - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }, TEST_TIMEOUT);
  });

  describe('Load Testing Simulation', () => {
    test('System should handle burst of requests', async () => {
      const burstSize = 20;
      const burstRequests = [];

      // Create a burst of session creation requests
      for (let i = 0; i < burstSize; i++) {
        const request = createTestRequest({ language: 'ja' }, '/api/session');
        burstRequests.push(sessionPOST(request));
      }

      const startTime = Date.now();
      const responses = await Promise.allSettled(burstRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Count successful responses
      const successfulResponses = responses.filter(
        response => response.status === 'fulfilled' && response.value.status === 201
      );

      // Should handle majority of requests successfully
      const successRate = successfulResponses.length / burstSize;
      expect(successRate).toBeGreaterThan(0.8); // 80% success rate

      console.log(`Burst test: ${successfulResponses.length}/${burstSize} successful in ${totalTime}ms`);
      console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);
    }, TEST_TIMEOUT);
  });

  describe('Performance Regression Detection', () => {
    test('API response times should be consistent', async () => {
      const numberOfTests = 5;
      const responseTimes = [];

      // Test session creation multiple times
      for (let i = 0; i < numberOfTests; i++) {
        const request = createTestRequest({ language: 'ja' }, '/api/session');
        
        const { duration } = await measureExecutionTime(async () => {
          return await sessionPOST(request);
        });
        
        responseTimes.push(duration);
      }

      // Calculate statistics
      const averageTime = responseTimes.reduce((a, b) => a + b, 0) / numberOfTests;
      const maxTime = Math.max(...responseTimes);
      const minTime = Math.min(...responseTimes);
      const variance = responseTimes.reduce((acc, time) => acc + Math.pow(time - averageTime, 2), 0) / numberOfTests;
      const standardDeviation = Math.sqrt(variance);

      // Response times should be reasonably consistent
      const coefficientOfVariation = standardDeviation / averageTime;
      expect(coefficientOfVariation).toBeLessThan(0.5); // Less than 50% variation

      console.log(`Response time statistics:`);
      console.log(`  Average: ${averageTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime}ms, Max: ${maxTime}ms`);
      console.log(`  Standard Deviation: ${standardDeviation.toFixed(2)}ms`);
      console.log(`  Coefficient of Variation: ${(coefficientOfVariation * 100).toFixed(1)}%`);
    }, TEST_TIMEOUT);
  });
});