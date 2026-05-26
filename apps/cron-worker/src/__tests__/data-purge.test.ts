/**
 * Unit tests for the `data-purge` cron handler.
 *
 * Coverage:
 *   1. No expired records → ok=true + totalPurged 0.
 *   2. Expired documents → R2 cleanup runs before the DB tx; safe ids deleted.
 *   3. Document query throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDocumentFindMany,
  mockTransaction,
  mockDeleteObject,
  mockPurgeOAuth,
  mockPurgePending,
  mockGauge,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockDocumentFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockDeleteObject: vi.fn(),
  mockPurgeOAuth: vi.fn(),
  mockPurgePending: vi.fn(),
  mockGauge: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    document: { findMany: mockDocumentFindMany },
    $transaction: mockTransaction,
  },
}));

vi.mock('@contractor-ops/api/services/r2', () => ({
  deleteObject: mockDeleteObject,
}));

vi.mock('@contractor-ops/api/services/oauth-challenge', () => ({
  purgeExpiredOAuthChallenges: mockPurgeOAuth,
}));

vi.mock('@contractor-ops/api/services/pending-upload', () => ({
  purgeExpiredPendingUploads: mockPurgePending,
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockGauge, increment: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { dataPurgeHandler } from '../jobs/handlers/data-purge.js';
import { makeJobContext } from './_helpers.js';

/** Tx stub — every child deleteMany returns a count; overridable per test. */
function makeTxStub(counts: Record<string, number> = {}) {
  const make = (key: string) => vi.fn(async () => ({ count: counts[key] ?? 0 }));
  return {
    documentLink: { deleteMany: make('documentLink') },
    invoiceFile: { deleteMany: make('invoiceFile') },
    document: { deleteMany: make('document') },
    invoice: { deleteMany: make('invoice') },
    contract: { deleteMany: make('contract') },
    contractor: { deleteMany: make('contractor') },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDocumentFindMany.mockResolvedValue([]);
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTxStub()));
  mockDeleteObject.mockResolvedValue(undefined);
  mockPurgeOAuth.mockResolvedValue(0);
  mockPurgePending.mockResolvedValue(0);
});

describe('dataPurgeHandler', () => {
  it('returns ok=true with totalPurged 0 when nothing is expired', async () => {
    const result = await dataPurgeHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ totalPurged: 0, retentionDays: 90 });
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it('purges R2 objects before the DB tx and excludes failed-R2 docs', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', storageKey: 'r2/key-1' },
      { id: 'doc-2', storageKey: null },
    ]);
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTxStub({ document: 1, invoice: 2 })),
    );
    mockPurgeOAuth.mockResolvedValue(3);
    mockPurgePending.mockResolvedValue(4);

    const result = await dataPurgeHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(mockDeleteObject).toHaveBeenCalledWith('r2/key-1');
    const details = result.details as { purged: Record<string, number>; totalPurged: number };
    expect(details.purged).toMatchObject({
      r2Files: 1,
      purgeSkippedR2KeyMissing: 1,
      documents: 1,
      invoices: 2,
      oauthChallenges: 3,
      pendingUploads: 4,
    });
  });

  it('returns ok=false and reports to Sentry when the document query throws', async () => {
    mockDocumentFindMany.mockRejectedValue(new Error('neon connection refused'));

    const result = await dataPurgeHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'neon connection refused' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
