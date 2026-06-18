import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force the in-memory fallback path by clearing Upstash env BEFORE the
// middleware module is evaluated (its `hasRedis` flag is module-scoped).
// vi.hoisted runs before any import resolution.
vi.hoisted(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

vi.mock('@sentry/node', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

import { t } from '../../init';
import {
  __getReportRateLimitMaxForTests,
  __resetReportRateLimitForTests,
  reportRateLimitMiddleware,
} from '../report-rate-limit';

describe('reportRateLimitMiddleware', () => {
  const router = t.router({
    read: t.procedure.use(reportRateLimitMiddleware).query(({ ctx }) => ({
      remaining: (ctx as { reportRateLimit?: { remaining: number } }).reportRateLimit?.remaining,
    })),
  });
  const createCaller = t.createCallerFactory(router);

  function callerWithOrg(organizationId: string | null) {
    return createCaller({
      headers: new Headers(),
      session: null,
      user: null,
      organizationId,
    } as never);
  }

  beforeEach(() => {
    __resetReportRateLimitForTests(5);
  });

  afterEach(() => {
    __resetReportRateLimitForTests();
    vi.restoreAllMocks();
  });

  it('exposes the production default of 30 calls/min', () => {
    __resetReportRateLimitForTests();
    expect(__getReportRateLimitMaxForTests()).toBe(30);
  });

  it('throws UNAUTHORIZED when organizationId is missing', async () => {
    await expect(callerWithOrg(null).read()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows requests under the limit and exposes remaining count', async () => {
    const caller = callerWithOrg('org-1');
    for (let i = 0; i < 5; i++) {
      const r = await caller.read();
      expect(r.remaining).toBe(5 - (i + 1));
    }
  });

  it('blocks over-budget requests with TOO_MANY_REQUESTS', async () => {
    const caller = callerWithOrg('org-2');
    for (let i = 0; i < 5; i++) {
      await caller.read();
    }
    await expect(caller.read()).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('allows requests again after the sliding window expires', async () => {
    let now = Date.now();
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);

    const caller = callerWithOrg('org-3');
    for (let i = 0; i < 5; i++) {
      await caller.read();
    }
    await expect(caller.read()).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    now += 61_000;

    await expect(caller.read()).resolves.toMatchObject({ remaining: 4 });

    dateNowSpy.mockRestore();
  });

  it('tracks different organizations with separate counters', async () => {
    const callerA = callerWithOrg('org-4');
    for (let i = 0; i < 5; i++) {
      await callerA.read();
    }
    await expect(callerA.read()).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    // A different org has its own budget.
    await expect(callerWithOrg('org-5').read()).resolves.toMatchObject({ remaining: 4 });
  });
});
