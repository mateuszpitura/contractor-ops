import { delay, HttpResponse } from 'msw';
import type { CapturedRequest, NetworkCondition } from './types.js';

/**
 * Apply network conditions (delay, error injection) before returning a response.
 * Throws a special StopHandling response if error injection triggers.
 * Returns void normally — call at the start of your handler.
 *
 * Usage:
 * ```ts
 * const errorResponse = await maybeError(net);
 * if (errorResponse) return errorResponse;
 * ```
 */
export async function applyNetworkConditions(
  condition: NetworkCondition | undefined,
): Promise<Response | null> {
  if (!condition) return null;

  // Apply delay
  if (condition.delayMs) {
    await delay(condition.delayMs);
  } else if (condition.delayRange) {
    const [min, max] = condition.delayRange;
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await delay(ms);
  }

  // Apply error injection
  if (condition.errorRate && Math.random() < condition.errorRate) {
    const status = condition.errorStatus ?? 500;
    const body = condition.errorBody ?? {
      error: 'Simulated error',
      message: 'This error was injected by test network conditions',
    };
    return HttpResponse.json(body, { status }) as Response;
  }

  return null;
}

/**
 * In-memory request capture for test assertions.
 * Use this to verify your system made the right outbound calls.
 */
export class RequestCapture {
  private requests: CapturedRequest[] = [];

  capture(url: string, method: string, headers: Record<string, string>, body: unknown): void {
    this.requests.push({ url, method, headers, body, timestamp: Date.now() });
  }

  /** Get all captured requests */
  getAll(): readonly CapturedRequest[] {
    return this.requests;
  }

  /** Get requests matching a URL pattern */
  getByUrl(pattern: string | RegExp): CapturedRequest[] {
    return this.requests.filter(r =>
      typeof pattern === 'string' ? r.url.includes(pattern) : pattern.test(r.url),
    );
  }

  /** Get requests matching an HTTP method */
  getByMethod(method: string): CapturedRequest[] {
    return this.requests.filter(r => r.method.toUpperCase() === method.toUpperCase());
  }

  /** Assert a request was made matching the given criteria */
  assertCalled(urlPattern: string | RegExp, method?: string): CapturedRequest {
    const matches = this.getByUrl(urlPattern).filter(
      r => !method || r.method.toUpperCase() === method.toUpperCase(),
    );
    if (matches.length === 0) {
      throw new Error(
        `Expected a ${method ?? 'any'} request matching ${String(urlPattern)}, but none was captured. ` +
          `Captured URLs: ${this.requests.map(r => `${r.method} ${r.url}`).join(', ') || '(none)'}`,
      );
    }
    return matches[0]!;
  }

  /** Assert no request was made matching the given criteria */
  assertNotCalled(urlPattern: string | RegExp, method?: string): void {
    const matches = this.getByUrl(urlPattern).filter(
      r => !method || r.method.toUpperCase() === method.toUpperCase(),
    );
    if (matches.length > 0) {
      throw new Error(
        `Expected no ${method ?? 'any'} request matching ${String(urlPattern)}, ` +
          `but ${matches.length} were captured`,
      );
    }
  }

  /** Get the count of captured requests */
  get count(): number {
    return this.requests.length;
  }

  /** Clear all captured requests */
  clear(): void {
    this.requests = [];
  }
}

/**
 * Generate a random UUID v4 for mock IDs.
 */
export function mockId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate an ISO date string offset from now.
 */
export function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

/**
 * Generate an ISO date string in the past.
 */
export function pastDate(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}
