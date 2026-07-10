import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force the in-memory fallback path by clearing Upstash env BEFORE the
// middleware module is evaluated (its `hasRedis` flag is module-scoped).
vi.hoisted(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
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
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

import { t } from '../../init';
import {
  __resetPortalRateLimitForTests,
  portalSubjectRateLimitMiddleware,
} from '../portal-rate-limit';

describe('portalSubjectRateLimitMiddleware', () => {
  const router = t.router({
    action: t.procedure.use(portalSubjectRateLimitMiddleware).query(({ ctx }) => ({
      remaining: (ctx as { portalRateLimit?: { remaining: number } }).portalRateLimit?.remaining,
    })),
  });
  const createCaller = t.createCallerFactory(router);

  function callerForSubject(fields: { contractorId?: string | null; workerId?: string | null }) {
    return createCaller({
      headers: new Headers(),
      session: null,
      user: null,
      ...fields,
    } as never);
  }

  beforeEach(() => {
    __resetPortalRateLimitForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws UNAUTHORIZED when no portal subject is present', async () => {
    await expect(
      callerForSubject({ contractorId: null, workerId: null }).action(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows the first 10 requests per contractor and exposes remaining', async () => {
    const caller = callerForSubject({ contractorId: `c-${Math.random().toString(36).slice(2)}` });
    for (let i = 0; i < 10; i++) {
      const r = await caller.action();
      expect(r.remaining).toBe(10 - (i + 1));
    }
  });

  it('throws TOO_MANY_REQUESTS on the 11th request in the same window', async () => {
    const caller = callerForSubject({ contractorId: `c11-${Math.random().toString(36).slice(2)}` });
    for (let i = 0; i < 10; i++) {
      await caller.action();
    }
    await expect(caller.action()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('keys on the employee worker id when contractorId is absent', async () => {
    const caller = callerForSubject({ workerId: `w-${Math.random().toString(36).slice(2)}` });
    for (let i = 0; i < 10; i++) {
      await caller.action();
    }
    await expect(caller.action()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('tracks different subjects with separate counters', async () => {
    const a = callerForSubject({ contractorId: `a-${Math.random().toString(36).slice(2)}` });
    const b = callerForSubject({ contractorId: `b-${Math.random().toString(36).slice(2)}` });
    for (let i = 0; i < 10; i++) {
      await a.action();
    }
    await expect(a.action()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    await expect(b.action()).resolves.toMatchObject({ remaining: 9 });
  });
});
