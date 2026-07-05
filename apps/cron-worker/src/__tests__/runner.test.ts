/**
 * Tests for the hardened cron-worker runner.
 *
 * Asserts:
 *   - `runJob` invokes the handler with a logger + traceId and records success.
 *   - A thrown handler records `failure` (no last-success) + Sentry capture.
 *   - Durable run-state is upserted (lastSuccessAt on success, lastRunAt only on failure).
 *   - Overlap guard: a second tick while the first is in flight is skipped.
 *   - Advisory lock: a tick that can't acquire the per-job lock is skipped.
 *   - Timeout: a hung handler is abandoned at `maxMs` and paged to Sentry.
 *   - Startup catch-up runs must-run jobs whose persisted last success is stale.
 *   - `/health` endpoint returns 200 + per-job status snapshot.
 */

import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTxQueryRawUnsafe,
  mockTxExecuteRawUnsafe,
  mockUpsert,
  mockFindUnique,
  mockCaptureException,
  mockCaptureMessage,
  mockIncrement,
  mockGauge,
} = vi.hoisted(() => ({
  mockTxQueryRawUnsafe: vi.fn(),
  mockTxExecuteRawUnsafe: vi.fn(),
  mockUpsert: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCaptureException: vi.fn(),
  mockCaptureMessage: vi.fn(),
  mockIncrement: vi.fn(),
  mockGauge: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => {
  const tx = {
    $queryRawUnsafe: mockTxQueryRawUnsafe,
    $executeRawUnsafe: mockTxExecuteRawUnsafe,
  };
  return {
    prismaRaw: {
      $transaction: (fn: (client: typeof tx) => unknown) => Promise.resolve(fn(tx)),
      cronJobRunState: { upsert: mockUpsert, findUnique: mockFindUnique },
    },
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: mockIncrement, gauge: mockGauge, distribution: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: mockCaptureMessage },
}));

import { buildHealthServer } from '../health.js';
import {
  __resetForTests,
  getLastRun,
  getLastSuccess,
  runJob,
  runStartupCatchUp,
} from '../jobs/runner.js';

const silentLog = pino({ level: 'silent' });

beforeEach(() => {
  vi.clearAllMocks();
  __resetForTests();
  // Advisory lock acquired by default.
  mockTxQueryRawUnsafe.mockResolvedValue([{ acquired: true }]);
  mockUpsert.mockResolvedValue({});
  mockFindUnique.mockResolvedValue(null);
});

afterEach(() => {
  __resetForTests();
});

describe('runJob', () => {
  it('invokes the handler with a logger + traceId and records success', async () => {
    let receivedTraceId: string | undefined;
    const meta = { name: 'unit-test-success', schedule: '0 * * * *' };

    const record = await runJob(meta, async ctx => {
      receivedTraceId = ctx.traceId;
      ctx.log.info({ ok: true }, 'inside handler');
      return { ok: true, durationMs: 1 };
    });

    expect(receivedTraceId).toBeTruthy();
    expect(record.status).toBe('success');
    expect(record.jobName).toBe('unit-test-success');
    expect(getLastSuccess('unit-test-success')).toBeDefined();
    expect(getLastRun('unit-test-success')?.status).toBe('success');
  });

  it('persists lastSuccessAt on success', async () => {
    await runJob({ name: 'persist-success', schedule: '0 * * * *' }, async () => ({
      ok: true,
      durationMs: 1,
    }));

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ jobName: 'persist-success' });
    expect(arg.update.lastSuccessAt).toBeInstanceOf(Date);
    expect(arg.update.lastRunAt).toBeInstanceOf(Date);
  });

  it('records failure when the handler throws and persists lastRunAt only', async () => {
    const meta = { name: 'unit-test-throw', schedule: '0 * * * *' };
    const record = await runJob(meta, async () => {
      throw new Error('boom');
    });

    expect(record.status).toBe('failure');
    expect(record.error).toBe('boom');
    expect(getLastSuccess('unit-test-throw')).toBeUndefined();
    expect(getLastRun('unit-test-throw')?.status).toBe('failure');
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.update.lastRunAt).toBeInstanceOf(Date);
    expect(arg.update.lastSuccessAt).toBeUndefined();
  });

  it('skips the tick when the previous run is still in flight (overlap guard)', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => {
      release = r;
    });
    const slowHandler = vi.fn(async () => {
      await gate;
      return { ok: true, durationMs: 1 };
    });
    const secondHandler = vi.fn(async () => ({ ok: true, durationMs: 1 }));
    const meta = { name: 'overlap-job', schedule: '* * * * *' };

    const first = runJob(meta, slowHandler);
    const secondRecord = await runJob(meta, secondHandler);

    expect(secondRecord.status).toBe('skipped');
    expect(secondHandler).not.toHaveBeenCalled();
    expect(mockIncrement).toHaveBeenCalledWith(
      'cron.tick.skipped_overlap',
      1,
      expect.objectContaining({ job: 'overlap-job' }),
    );

    release();
    const firstRecord = await first;
    expect(firstRecord.status).toBe('success');
  });

  it('skips the tick when another replica holds the advisory lock', async () => {
    mockTxQueryRawUnsafe.mockResolvedValue([{ acquired: false }]);
    const handler = vi.fn(async () => ({ ok: true, durationMs: 1 }));

    const record = await runJob({ name: 'locked-job', schedule: '* * * * *' }, handler);

    expect(record.status).toBe('skipped');
    expect(handler).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockIncrement).toHaveBeenCalledWith(
      'cron.tick.skipped_locked',
      1,
      expect.objectContaining({ job: 'locked-job' }),
    );
  });

  it('abandons a hung handler at maxMs and pages Sentry (timeout)', async () => {
    const hung = vi.fn(() => new Promise<{ ok: boolean; durationMs: number }>(() => {}));
    const meta = { name: 'hung-job', schedule: '* * * * *', maxMs: 25 };

    const record = await runJob(meta, hung);

    expect(record.status).toBe('failure');
    expect(record.error).toContain('25ms budget');
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [msg, opts] = mockCaptureMessage.mock.calls[0];
    expect(msg).toContain('timed out');
    expect(opts.tags['cron.outcome']).toBe('timeout');
  });
});

describe('runStartupCatchUp', () => {
  const catchUpMeta = {
    name: 'daily-catchup',
    schedule: '0 3 * * *',
    maxMs: 5_000,
    intervalMs: 86_400_000,
    catchUpOnBoot: true,
  };

  it('runs a must-run job whose persisted last success is stale', async () => {
    mockFindUnique.mockResolvedValue({ lastSuccessAt: null });
    const handler = vi.fn(async () => ({ ok: true, durationMs: 1 }));

    await runStartupCatchUp([{ meta: catchUpMeta, handler }], silentLog);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockIncrement).toHaveBeenCalledWith(
      'cron.catchup.run',
      1,
      expect.objectContaining({ job: 'daily-catchup' }),
    );
  });

  it('does not re-run a job whose last success is within the interval', async () => {
    mockFindUnique.mockResolvedValue({ lastSuccessAt: new Date() });
    const handler = vi.fn(async () => ({ ok: true, durationMs: 1 }));

    await runStartupCatchUp([{ meta: catchUpMeta, handler }], silentLog);

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores jobs that are not marked catchUpOnBoot', async () => {
    const handler = vi.fn(async () => ({ ok: true, durationMs: 1 }));

    await runStartupCatchUp(
      [{ meta: { name: 'no-catchup', schedule: '*/5 * * * *', intervalMs: 300_000 }, handler }],
      silentLog,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe('/health endpoint', () => {
  it('returns ok + the per-job status snapshot', async () => {
    await runJob({ name: 'health-fixture', schedule: '0 * * * *' }, async () => ({
      ok: true,
      durationMs: 5,
    }));

    const app = await buildHealthServer();
    await app.ready();
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({ ok: true, service: 'cron-worker' });
      expect(body.jobs['health-fixture']).toBeDefined();
      expect(body.jobs['health-fixture'].lastSuccess.status).toBe('success');
    } finally {
      await app.close();
    }
  });
});
