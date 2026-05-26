/**
 * Smoke tests for the cron-worker scaffold (Step 6 verify gate).
 *
 * Asserts:
 *   - `runJob` invokes the handler with a logger + traceId.
 *   - A successful run updates `getLastSuccess(jobName)`.
 *   - A thrown handler does NOT update `getLastSuccess` but does update
 *     `getLastRun` with `status: 'failure'`.
 *   - `/health` endpoint returns 200 + per-job status snapshot.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildHealthServer } from '../health.js';
import { __resetForTests, getLastRun, getLastSuccess, runJob } from '../jobs/runner.js';

beforeEach(() => {
  __resetForTests();
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

  it('records failure when the handler throws', async () => {
    const meta = { name: 'unit-test-throw', schedule: '0 * * * *' };
    const record = await runJob(meta, async () => {
      throw new Error('boom');
    });

    expect(record.status).toBe('failure');
    expect(record.error).toBe('boom');
    expect(getLastSuccess('unit-test-throw')).toBeUndefined();
    expect(getLastRun('unit-test-throw')?.status).toBe('failure');
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
