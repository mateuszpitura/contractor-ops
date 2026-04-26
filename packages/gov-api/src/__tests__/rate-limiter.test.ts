import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockLimit } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
}));

vi.mock('@upstash/redis', () => {
  class MockRedis {}
  return { Redis: MockRedis };
});

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockLimit;
    static slidingWindow = vi.fn(() => 'sliding-window-config');
  }
  return { Ratelimit: MockRatelimit };
});

import { GovApiRateLimiter } from '../rate-limiter.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GovApiRateLimiter', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('with Redis configured', () => {
    beforeEach(() => {
      process.env = {
        ...originalEnv,
        UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
        UPSTASH_REDIS_REST_TOKEN: 'test-token',
      };
    });

    it('allows requests within the limit', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        remaining: 9,
        reset: Date.now() + 60000,
      });

      const limiter = new GovApiRateLimiter('zatca', {
        maxRequests: 10,
        windowMs: 60000,
      });

      const result = await limiter.checkLimit('org-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('blocks requests exceeding the limit', async () => {
      mockLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        reset: Date.now() + 30000,
      });

      const limiter = new GovApiRateLimiter('zatca', {
        maxRequests: 10,
        windowMs: 60000,
      });

      const result = await limiter.checkLimit('org-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('uses API name as key prefix', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        remaining: 5,
        reset: 0,
      });

      const limiter = new GovApiRateLimiter('peppol-ae', {
        maxRequests: 20,
        windowMs: 60000,
      });

      await limiter.checkLimit('org-42');
      expect(mockLimit).toHaveBeenCalledWith('peppol-ae:org-42');
    });

    it('fails open when Redis throws', async () => {
      mockLimit.mockRejectedValue(new Error('Redis connection failed'));

      const limiter = new GovApiRateLimiter('zatca', {
        maxRequests: 10,
        windowMs: 60000,
      });

      const result = await limiter.checkLimit('org-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });
  });

  describe('without Redis configured', () => {
    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('allows all requests when Redis is not configured', async () => {
      const limiter = new GovApiRateLimiter('zatca', {
        maxRequests: 10,
        windowMs: 60000,
      });

      const result = await limiter.checkLimit('org-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });
});
