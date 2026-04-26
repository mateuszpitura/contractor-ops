// ---------------------------------------------------------------------------
// Government API Rate Limiter
// ---------------------------------------------------------------------------

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { GovApiRateLimitConfig } from './types.js';

/**
 * Per-API sliding window rate limiter backed by Upstash Redis.
 *
 * Fail-open design: if Redis is unavailable or the rate limit check
 * throws, requests are allowed through (government API operations should
 * not be blocked by our own infrastructure failures).
 */
export class GovApiRateLimiter {
  private limiter: Ratelimit | null = null;
  private readonly apiName: string;
  private readonly config: GovApiRateLimitConfig;

  constructor(apiName: string, config: GovApiRateLimitConfig) {
    this.apiName = apiName;
    this.config = config;
    this.initLimiter();
  }

  private initLimiter(): void {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!(url && token)) {
      // No Redis configured — allow all requests (dev mode)
      return;
    }
    const redis = new Redis({ url, token });
    this.limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(this.config.maxRequests, `${this.config.windowMs} ms`),
      prefix: `gov-api:${this.apiName}`,
    });
  }

  /**
   * Check if the request is within the rate limit.
   *
   * @param identifier - Unique key for the rate limit scope (e.g., orgId)
   * @returns Object with allowed status, remaining quota, and reset time
   */
  async checkLimit(
    identifier: string,
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    if (!this.limiter) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetMs: 0,
      };
    }
    try {
      const result = await this.limiter.limit(`${this.apiName}:${identifier}`);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetMs: result.reset,
      };
    } catch {
      // Redis failure — fail open (allow request)
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetMs: 0,
      };
    }
  }
}
