// ---------------------------------------------------------------------------
// Government API Rate Limiter
// ---------------------------------------------------------------------------

import type { Logger } from '@contractor-ops/logger';
import { createLogger } from '@contractor-ops/logger';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { GovApiRateLimitConfig } from './types.js';

/** Throttle Redis-failure warnings to one per minute per limiter instance. */
const REDIS_WARN_THROTTLE_MS = 60_000;

/**
 * Optional explicit Redis credentials. When omitted, the limiter reads
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` from `process.env`
 * lazily on first `checkLimit()` call (so env loading order doesn't cause
 * a permanent silent disable).
 */
export interface GovApiRateLimiterOptions {
  redisUrl?: string;
  redisToken?: string;
  /** Inject a Pino logger; defaults to a child of the project logger. */
  logger?: Logger;
}

/**
 * Per-API sliding window rate limiter backed by Upstash Redis.
 *
 * Fail-open design: if Redis is unavailable or the rate limit check
 * throws, requests are allowed through (government API operations should
 * not be blocked by our own infrastructure failures). Redis failures
 * are logged at WARN with intra-process throttling so a sustained outage
 * cannot spam the log pipeline.
 */
export class GovApiRateLimiter {
  private limiter: Ratelimit | null = null;
  private readonly apiName: string;
  private readonly config: GovApiRateLimitConfig;
  private readonly explicitRedisUrl?: string;
  private readonly explicitRedisToken?: string;
  private readonly log: Logger;
  private initialized = false;
  private lastRedisWarnAt = 0;

  constructor(
    apiName: string,
    config: GovApiRateLimitConfig,
    options: GovApiRateLimiterOptions = {},
  ) {
    this.apiName = apiName;
    this.config = config;
    this.explicitRedisUrl = options.redisUrl;
    this.explicitRedisToken = options.redisToken;
    this.log = options.logger ?? createLogger({ service: 'gov-api-ratelimit', apiName });
  }

  /**
   * Lazy-initialise the underlying Upstash limiter on first use.
   * Reading env at construction time made the limiter silently no-op when
   * the constructor ran before the env was fully loaded (test setup,
   * lambda cold-start with delayed config fetch).
   */
  private initLimiterIfNeeded(): void {
    if (this.initialized) return;
    this.initialized = true;
    const url = this.explicitRedisUrl ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = this.explicitRedisToken ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!(url && token)) {
      this.log.info(
        { apiName: this.apiName, redisConfigured: false },
        'gov-api rate limiter: no Redis configured — allowing all requests',
      );
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
    this.initLimiterIfNeeded();
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
    } catch (err) {
      // Redis failure — fail open (allow request) but surface a throttled WARN
      // so prolonged outages are detectable. Spamming on every request would
      // drown the log pipeline; one warn per minute per limiter is enough to
      // page on while keeping tail volume manageable.
      this.warnRedisFailure(err, identifier);
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetMs: 0,
      };
    }
  }

  private warnRedisFailure(err: unknown, identifier: string): void {
    const now = Date.now();
    if (now - this.lastRedisWarnAt < REDIS_WARN_THROTTLE_MS) return;
    this.lastRedisWarnAt = now;
    this.log.warn(
      { err, apiName: this.apiName, identifier },
      'gov-api rate limiter Redis check failed — failing open',
    );
  }
}
