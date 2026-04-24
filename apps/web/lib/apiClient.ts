/**
 * API Client with fallback and retry mechanisms
 * Provides robust error handling and circuit breaker pattern
 */

interface RetryOptions {
  maxRetries?: number
  delayMs?: number
  backoffMultiplier?: number
}

interface CircuitBreakerOptions {
  failureThreshold?: number
  resetTimeoutMs?: number
}

/**
 * Circuit breaker state management
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private lastFailureTime: number | null = null
  private failureThreshold: number
  private resetTimeoutMs: number

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.resetTimeoutMs = options.resetTimeoutMs ?? 60000 // 1 minute
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime ?? 0) > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
        this.failureCount = 0
      } else {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.')
      }
    }

    try {
      const result = await fn()
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED'
        this.failureCount = 0
      }
      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN'
      }

      throw error
    }
  }

  getState() {
    return this.state
  }

  reset() {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.lastFailureTime = null
  }
}

/**
 * Retry mechanism with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  const delayMs = options.delayMs ?? 1000
  const backoffMultiplier = options.backoffMultiplier ?? 2

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt)
        console.warn(
          `Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError ?? new Error('Max retries exceeded')
}

/**
 * Call API with fallback value
 */
export async function callWithFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorContext: string = 'API call'
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`${errorContext} failed: ${errorMsg}. Using fallback.`)
    return fallback
  }
}

/**
 * Call API with retry mechanism
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return retryWithBackoff(fn, options)
}

/**
 * API client with circuit breaker
 */
export class APIClient {
  private circuitBreaker: CircuitBreaker

  constructor(circuitBreakerOptions?: CircuitBreakerOptions) {
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions)
  }

  async fetch<T>(
    url: string,
    options?: RequestInit & { retryOptions?: RetryOptions }
  ): Promise<T> {
    const { retryOptions, ...fetchOptions } = options ?? {}

    const fetchFn = async () => {
      const response = await fetch(url, fetchOptions)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return response.json() as Promise<T>
    }

    return this.circuitBreaker.execute(() => retryWithBackoff(fetchFn, retryOptions))
  }

  async post<T>(
    url: string,
    data: any,
    options?: RequestInit & { retryOptions?: RetryOptions }
  ): Promise<T> {
    const { retryOptions, ...fetchOptions } = options ?? {}

    return this.fetch<T>(url, {
      ...fetchOptions,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions?.headers,
      },
      body: JSON.stringify(data),
      retryOptions,
    })
  }

  async patch<T>(
    url: string,
    data: any,
    options?: RequestInit & { retryOptions?: RetryOptions }
  ): Promise<T> {
    const { retryOptions, ...fetchOptions } = options ?? {}

    return this.fetch<T>(url, {
      ...fetchOptions,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions?.headers,
      },
      body: JSON.stringify(data),
      retryOptions,
    })
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState()
  }

  resetCircuitBreaker() {
    this.circuitBreaker.reset()
  }
}

// Export singleton instance
export const apiClient = new APIClient({
  failureThreshold: 5,
  resetTimeoutMs: 60000,
})
