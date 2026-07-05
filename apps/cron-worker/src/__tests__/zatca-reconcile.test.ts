/**
 * Unit tests for the `zatca-reconcile` cron handler.
 *
 * The handler is a thin wrapper: it reads the stale window from env and
 * delegates the query + resubmission to `reconcilePendingZatcaChains` in
 * `packages/api`. These tests assert the wiring and the JobResult contract
 * (`ok` reflects whether any chain still failed; a thrown sweep is caught and
 * paged to Sentry) — the resubmission logic itself is covered in the service.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReconcile, mockCaptureException } = vi.hoisted(() => ({
  mockReconcile: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/zatca-submission', () => ({
  reconcilePendingZatcaChains: mockReconcile,
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

vi.mock('../env.js', () => ({
  loadEnv: () => ({ CRON_ZATCA_RECONCILE_STALE_MINUTES: 20 }),
}));

import { zatcaReconcileHandler } from '../jobs/handlers/zatca-reconcile.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('zatcaReconcileHandler', () => {
  it('passes the configured stale window and reports ok when nothing failed', async () => {
    mockReconcile.mockResolvedValue({ scanned: 3, settled: 3, failed: 0 });

    const result = await zatcaReconcileHandler(makeJobContext());

    expect(mockReconcile).toHaveBeenCalledWith({ olderThanMinutes: 20 });
    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 3, settled: 3, failed: 0 });
  });

  it('reports ok=false when some chains still failed', async () => {
    mockReconcile.mockResolvedValue({ scanned: 2, settled: 1, failed: 1 });

    const result = await zatcaReconcileHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ scanned: 2, settled: 1, failed: 1 });
  });

  it('returns ok=false and reports to Sentry when the sweep throws', async () => {
    mockReconcile.mockRejectedValue(new Error('db down'));

    const result = await zatcaReconcileHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'db down' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
