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
  startSpan,
  captureException,
}));

vi.mock('@contractor-ops/logger', () => ({
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
    expect(arg.ctx.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

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
