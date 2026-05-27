/**
 * Global per-IP rate limiter for @contractor-ops/api-server.
 *
 * Routing matrix:
 *
 *   - /api/auth/*    → exempt (Better Auth owns granular per-endpoint
 *                      limits, account lockout, Turnstile).
 *   - /api/portal/*  → 10 req/min per IP.
 *   - /api/* (rest)  → 60 req/min per IP.
 *
 * Hooked at `preHandler` so route handlers never see throttled traffic.
 * On `RateLimiterUnavailableError` (prod-only fail-closed posture) the
 * client gets 503 + `Retry-After: 5`; on `allowed === false` the client
 * gets 429 + `Retry-After: 60` plus the X-RateLimit-* headers.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../env.js';
import { createClientIpExtractor } from '../lib/client-ip.js';
import { createRateLimiter, RateLimiterUnavailableError } from '../lib/rate-limit-store.js';

export async function registerRateLimit(app: FastifyInstance, env: Env): Promise<void> {
  const failurePosture = env.NODE_ENV === 'production' ? 'production' : 'permissive';

  // Test mode — emit the X-RateLimit-* contract headers but never
  // actually throttle. Vitest test files instantiate independent Fastify
  // apps but share the same Upstash Redis namespace via `.env`, so per-IP
  // slots get consumed across the whole suite and cause spurious 429s
  // once enough integration POSTs accumulate. The rate-limit unit suite
  // covers the throttle behaviour directly.
  if (env.NODE_ENV === 'test') {
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      const url = request.url;
      if (url.startsWith('/api/auth')) return;
      if (url === '/health' || url === '/ready' || url === '/csp-report') return;
      reply.header('X-RateLimit-Limit', '10000');
      reply.header('X-RateLimit-Remaining', '10000');
      reply.header('X-RateLimit-Reset', '60');
    });
    return;
  }

  const portalLimiter = createRateLimiter({
    max: 10,
    window: '1 m',
    prefix: 'portal',
    failurePosture,
    redisUrl: env.UPSTASH_REDIS_REST_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const apiLimiter = createRateLimiter({
    max: 60,
    window: '1 m',
    prefix: 'api',
    failurePosture,
    redisUrl: env.UPSTASH_REDIS_REST_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const extractIp = createClientIpExtractor(env.TRUSTED_PROXIES);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url;
    // Exempt: Better Auth handles its own throttling on /api/auth/**.
    if (url.startsWith('/api/auth')) return;
    // Exempt: health/ready/csp-report — operator probes + browser beacons.
    if (url === '/health' || url === '/ready' || url === '/csp-report') return;

    const limiter =
      url.startsWith('/api/portal') || url.startsWith('/portal') ? portalLimiter : apiLimiter;

    const identifier = extractIp(request);
    try {
      const result = await limiter.check(identifier);
      reply.header('X-RateLimit-Limit', String(result.limit));
      reply.header('X-RateLimit-Remaining', String(result.remaining));
      if (result.reset > 0) {
        reply.header('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)));
      }
      if (!result.allowed) {
        reply.header('Retry-After', '60');
        return reply.code(429).send({ error: 'Too many requests. Please try again later.' });
      }
    } catch (err) {
      if (err instanceof RateLimiterUnavailableError) {
        reply.header('Retry-After', '5');
        return reply
          .code(503)
          .send({ error: 'Service temporarily unavailable. Please retry in a moment.' });
      }
      throw err;
    }
  });
}
