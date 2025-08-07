// Integration test setup
process.env.NODE_ENV = 'test'
process.env.GEMINI_API_KEY = 'test-api-key-AIzaSyTest123'
process.env.LOG_LEVEL = 'ERROR'

// Mock external services for integration tests
global.fetch = jest.fn()

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
  
  // Default fetch mock response
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  })
  
  // Clear rate limiting state
  jest.clearAllTimers()
  jest.useFakeTimers()
})

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks()
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})