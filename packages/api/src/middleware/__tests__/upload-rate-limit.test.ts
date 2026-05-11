import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force the in-memory fallback path by clearing Upstash env BEFORE the
// middleware module is evaluated (its `hasRedis` flag is module-scoped).
vi.hoisted(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

vi.mock('@sentry/nextjs', () => {
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
import { authedProcedure } from '../auth';
import { __resetUploadRateLimitForTests, uploadRateLimitMiddleware } from '../upload-rate-limit';

function ctxForUser(userId: string) {
  const session = {
    session: {
      id: 'sess-1',
      userId,
      activeOrganizationId: 'org_up',
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test',
      email: 't@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return {
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  };
}

describe('uploadRateLimitMiddleware', () => {
  const router = t.router({
    upload: authedProcedure.use(uploadRateLimitMiddleware).query(({ ctx }) => ({
      remaining: ctx.uploadRateLimit?.remaining,
    })),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    __resetUploadRateLimitForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws UNAUTHORIZED when user id is missing', async () => {
    await expect(
      createCaller({
        headers: new Headers(),
        session: null,
        user: null,
      }).upload(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows first 10 uploads and exposes remaining count', async () => {
    const uid = `u-rate-${Math.random().toString(36).slice(2)}`;
    const c = createCaller(ctxForUser(uid));
    for (let i = 0; i < 10; i++) {
      const r = await c.upload();
      expect(r.remaining).toBe(10 - (i + 1));
    }
  });

  it('throws TOO_MANY_REQUESTS on the 11th upload in the same window', async () => {
    const uid = `u-11-${Math.random().toString(36).slice(2)}`;
    const c = createCaller(ctxForUser(uid));
    for (let i = 0; i < 10; i++) {
      await c.upload();
    }
    await expect(c.upload()).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('allows uploads again after the window expires', async () => {
    const uid = `u-win-${Math.random().toString(36).slice(2)}`;
    const c = createCaller(ctxForUser(uid));
    const baseTime = Date.now();
    let fakeNow = baseTime;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    for (let i = 0; i < 10; i++) {
      await c.upload();
    }
    await expect(c.upload()).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    // Advance 61 seconds past the window — all timestamps now expire
    fakeNow = baseTime + 61_000;
    const r = await c.upload();
    expect(r.remaining).toBe(9);
  });
});
