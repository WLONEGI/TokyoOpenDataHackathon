// Performance test setup
process.env.NODE_ENV = 'test'
process.env.GEMINI_API_KEY = 'test-api-key-AIzaSyTest123'
process.env.LOG_LEVEL = 'ERROR' // Minimize logging during performance tests

// Mock external services for performance tests
global.fetch = jest.fn()

// Performance test specific setup
beforeEach(() => {
  jest.clearAllMocks()
  
  // Default fetch mock response
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  })
  
  // Clear timers to avoid interference
  jest.clearAllTimers()
  jest.useFakeTimers({ advanceTimers: true })
})

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks()
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
  
  // Force garbage collection if available
  if (typeof global.gc === 'function') {
    global.gc()
  }
})

// Global setup for performance monitoring
global.performanceMetrics = {
  startTime: Date.now(),
  measurements: []
}

// Helper to record performance measurements
global.recordPerformanceMetric = (name, value, unit = 'ms') => {
  global.performanceMetrics.measurements.push({
    name,
    value,
    unit,
    timestamp: Date.now()
  })
}

// Log performance summary after all tests
afterAll(() => {
  const { measurements } = global.performanceMetrics
  if (measurements.length > 0) {
    console.log('\n=== Performance Test Summary ===')
    measurements.forEach(metric => {
      console.log(`${metric.name}: ${metric.value}${metric.unit}`)
    })
    console.log('=================================\n')
  }
})