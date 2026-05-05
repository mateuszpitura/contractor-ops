import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSpan, startSpan, captureException, logInfo, logError, distribution, increment } =
  vi.hoisted(() => {
    const mockSpan = { setStatus: vi.fn() };
    const startSpan = vi.fn((_opts: unknown, fn: (span: typeof mockSpan) => Promise<unknown>) =>
      fn(mockSpan),
    );
    const captureException = vi.fn();
    const logInfo = vi.fn();
    const logError = vi.fn();
    const distribution = vi.fn();
    const increment = vi.fn();
    return {
      mockSpan,
      startSpan,
      captureException,
      logInfo,
      logError,
      distribution,
      increment,
    };
  });

vi.mock('@sentry/nextjs', () => ({
  getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setContext: vi.fn(), setExtra: vi.fn(), clear: vi.fn() })),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
  startSpan,
  captureException,
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({
    info: logInfo,
    error: logError,
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { distribution, increment },
}));

import { observabilityMiddleware } from '../observability.js';

describe('observabilityMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const minimalCtx = {
    headers: new Headers(),
    session: null,
    user: null,
  };

  it('runs next, attaches requestId, and records ok metrics', async () => {
    const next = vi.fn().mockResolvedValue({ data: 1 });

    const out = await observabilityMiddleware({
      path: 'invoice.list',
      type: 'query',
      ctx: minimalCtx,
      next,
    });

    expect(out).toEqual({ data: 1 });
    expect(next).toHaveBeenCalledTimes(1);
    const arg = next.mock.calls[0]?.[0] as { ctx: { requestId: string } };
    // P2-E/F-OBS-02: observabilityMiddleware now defers requestId minting to
    // `generateRequestId` from @contractor-ops/logger so the same id flows
    // through the AsyncLocalStorage Pino mixin. The logger module is mocked
    // (`generateRequestId: () => 'test-request-id'`), so we assert the test
    // double's value is propagated unchanged into the next ctx — that's the
    // actual contract this test is guarding (id flows from generator → ctx).
    expect(arg.ctx.requestId).toBe('test-request-id');

    expect(startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'trpc/invoice.list',
        op: 'trpc.procedure',
        attributes: expect.objectContaining({
          'trpc.procedure': 'invoice.list',
          'trpc.type': 'query',
        }),
      }),
      expect.any(Function),
    );
    expect(increment).toHaveBeenCalledWith(
      'trpc.calls',
      1,
      expect.objectContaining({
        procedure: 'invoice.list',
        type: 'query',
        status: 'ok',
      }),
    );
    expect(distribution).toHaveBeenCalledWith(
      'trpc.duration',
      expect.any(Number),
      expect.objectContaining({
        unit: 'millisecond',
        tags: { procedure: 'invoice.list', type: 'query' },
      }),
    );
    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
  });

  it('adds user.id and org.id to Sentry span attributes when session is present', async () => {
    const next = vi.fn().mockResolvedValue(null);
    const ctxWithSession = {
      headers: new Headers(),
      user: { id: 'user-42' },
      session: {
        user: { id: 'user-42' },
        session: { activeOrganizationId: 'org-7' },
      },
    };

    await observabilityMiddleware({
      path: 'settings.get',
      type: 'query',
      // Narrow session shape sufficient for observability attributes
      ctx: ctxWithSession as typeof minimalCtx & {
        user: { id: string };
        session: { user: { id: string }; session: { activeOrganizationId: string } };
      },
      next,
    });

    expect(startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({
          'trpc.procedure': 'settings.get',
          'trpc.type': 'query',
          'user.id': 'user-42',
          'org.id': 'org-7',
        }),
      }),
      expect.any(Function),
    );
  });

  it('rethrows errors, captures exception, and records error metrics', async () => {
    const boom = new Error('procedure blew up');
    const next = vi.fn().mockRejectedValue(boom);

    await expect(
      observabilityMiddleware({
        path: 'payment.create',
        type: 'mutation',
        ctx: minimalCtx,
        next,
      }),
    ).rejects.toThrow('procedure blew up');

    expect(captureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: {
          'trpc.procedure': 'payment.create',
          'trpc.type': 'mutation',
        },
      }),
    );
    expect(increment).toHaveBeenCalledWith(
      'trpc.calls',
      1,
      expect.objectContaining({
        procedure: 'payment.create',
        type: 'mutation',
        status: 'error',
      }),
    );
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: 'internal_error',
    });
  });
});
