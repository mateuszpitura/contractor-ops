import { describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: () => ({ CRON_SECRET: 'test-cron-secret-value' }),
}));

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
import { cronProcedure } from '../cron-trpc';

describe('cronProcedure', () => {
  const router = t.router({
    cronJob: cronProcedure.query(() => 'cron-ok'),
  });
  const createCaller = t.createCallerFactory(router);

  it('passes through with valid Bearer CRON_SECRET', async () => {
    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer test-cron-secret-value' }),
      session: null,
      user: null,
    });
    await expect(caller.cronJob()).resolves.toBe('cron-ok');
  });

  it('throws UNAUTHORIZED when Authorization header is missing', async () => {
    const caller = createCaller({
      headers: new Headers(),
      session: null,
      user: null,
    });
    await expect(caller.cronJob()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when token is wrong', async () => {
    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer wrong-secret' }),
      session: null,
      user: null,
    });
    await expect(caller.cronJob()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when Bearer prefix is missing', async () => {
    const caller = createCaller({
      headers: new Headers({ authorization: 'test-cron-secret-value' }),
      session: null,
      user: null,
    });
    await expect(caller.cronJob()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when token has extra characters appended', async () => {
    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer test-cron-secret-value-extra' }),
      session: null,
      user: null,
    });
    await expect(caller.cronJob()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
