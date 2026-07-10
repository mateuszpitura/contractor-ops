/**
 * Unit tests for the `peppol-reconcile` cron handler.
 *
 * The handler is a thin wrapper: it delegates the candidate query + re-enqueue
 * to `reconcileMissingPeppolOutboundEnqueues` in `packages/api`. These tests
 * assert the wiring and the JobResult contract (`ok` reflects whether any
 * enqueue failed; a thrown sweep is caught and paged to Sentry) — the enqueue
 * logic itself is covered in the service.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReconcile, mockCaptureException } = vi.hoisted(() => ({
  mockReconcile: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/einvoice-submission-triggers', () => ({
  reconcileMissingPeppolOutboundEnqueues: mockReconcile,
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { peppolReconcileHandler } from '../jobs/handlers/peppol-reconcile.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('peppolReconcileHandler', () => {
  it('reports ok when every missing enqueue was re-published', async () => {
    mockReconcile.mockResolvedValue({ scanned: 4, enqueued: 2, failed: 0 });

    const result = await peppolReconcileHandler(makeJobContext());

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 4, enqueued: 2, failed: 0 });
  });

  it('reports ok=false when some enqueues failed', async () => {
    mockReconcile.mockResolvedValue({ scanned: 3, enqueued: 1, failed: 2 });

    const result = await peppolReconcileHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ scanned: 3, enqueued: 1, failed: 2 });
  });

  it('returns ok=false and reports to Sentry when the sweep throws', async () => {
    mockReconcile.mockRejectedValue(new Error('db down'));

    const result = await peppolReconcileHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'db down' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
