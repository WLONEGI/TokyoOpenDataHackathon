/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Performance Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/performance/**/*.test.{js,ts,tsx}'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/performance/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 60000, // 1 minute timeout for performance tests
  maxWorkers: 1, // Run performance tests sequentially
  clearMocks: true,
  // Performance test specific configuration
  verbose: true,
  collectCoverage: false, // Disable coverage for performance tests
  // Expose garbage collection for memory testing
  setupFiles: ['<rootDir>/tests/performance/gc-setup.js'],
};