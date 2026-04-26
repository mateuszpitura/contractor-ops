import { describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: () => ({ CRON_SECRET: 'test-cron-secret-value' }),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

import { t } from '../../init.js';
import { cronProcedure } from '../cron-trpc.js';

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
