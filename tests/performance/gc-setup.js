// Expose garbage collection for memory testing
// This file is loaded before Jest starts to expose the gc function

// Check if garbage collection is available
if (typeof global.gc !== 'function') {
  // Mock gc function if not available
  global.gc = () => {
    // If actual gc is not available, try to trigger it via other means
    if (typeof process !== 'undefined' && process.nextTick) {
      // Use setTimeout to allow the event loop to process
      return new Promise(resolve => {
        setTimeout(() => {
          resolve()
        }, 10)
      })
    }
  }
}

// Provide memory usage helper
global.getMemoryUsage = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage()
  }
  return {
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
    arrayBuffers: 0
  }
}