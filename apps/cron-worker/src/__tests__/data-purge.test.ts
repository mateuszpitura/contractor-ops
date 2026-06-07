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
  mockGetRetentionCutoff,
} = vi.hoisted(() => ({
  mockDocumentFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockDeleteObject: vi.fn(),
  mockPurgeOAuth: vi.fn(),
  mockPurgePending: vi.fn(),
  mockGauge: vi.fn(),
  mockCaptureException: vi.fn(),
  // Defaults to "no retention rule" → every model keeps the flat 90-day sweep
  // (matches the EMPTY production map, D-06). Overridden per-test to inject a
  // fixture window and prove the wiring.
  mockGetRetentionCutoff: vi.fn<(model: string, now: Date) => Date | null>(() => null),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    document: { findMany: mockDocumentFindMany },
    $transaction: mockTransaction,
  },
  getRetentionCutoff: mockGetRetentionCutoff,
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

/**
 * Tx stub — every child deleteMany returns a count and records its `where` arg
 * (so tests can assert the per-model retention cutoff); overridable per test.
 */
function makeTxStub(counts: Record<string, number> = {}) {
  const make = (key: string) =>
    vi.fn(async (_args: { where: unknown }) => ({ count: counts[key] ?? 0 }));
  return {
    documentLink: { deleteMany: make('documentLink') },
    invoiceFile: { deleteMany: make('invoiceFile') },
    document: { deleteMany: make('document') },
    invoice: { deleteMany: make('invoice') },
    contract: { deleteMany: make('contract') },
    contractor: { deleteMany: make('contractor') },
  };
}

/** Extracts the `lt` cutoff a deleteMany was called with. */
function cutoffOf(mock: ReturnType<typeof vi.fn>): Date {
  const call = mock.mock.calls[0]?.[0] as { where: { deletedAt: { lt: Date } } };
  return call.where.deletedAt.lt;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDocumentFindMany.mockResolvedValue([]);
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTxStub()));
  mockDeleteObject.mockResolvedValue(undefined);
  mockPurgeOAuth.mockResolvedValue(0);
  mockPurgePending.mockResolvedValue(0);
  mockGetRetentionCutoff.mockImplementation(() => null);
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

  // US-INFRA-03 — THE load-bearing hard-delete path. The cron runs on the base
  // prisma (no soft-delete extension), so a retained model must use its policy
  // window (4yr/7yr) instead of the flat 90-day cutoff. The fixture maps
  // `Invoice` to a 4-year window (production map stays EMPTY, D-06).
  describe('retention-aware purge (US-INFRA-03)', () => {
    const FOUR_YEARS_MS = 4 * 365 * 24 * 60 * 60 * 1000;
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

    /** Fixture: Invoice retained 4 years; all other models unmapped (flat 90d). */
    function fixtureRetention(model: string, now: Date): Date | null {
      if (model === 'Invoice') {
        const cutoff = new Date(now);
        cutoff.setFullYear(cutoff.getFullYear() - 4);
        return cutoff;
      }
      return null;
    }

    it('CANNOT hard-delete in-window: a retained model uses its 4yr window, not the flat 90d sweep', async () => {
      mockGetRetentionCutoff.mockImplementation((model: string, now: Date) =>
        fixtureRetention(model, now),
      );
      const tx = makeTxStub({ invoice: 0, contract: 0, contractor: 0 });
      mockTransaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

      const before = Date.now();
      await dataPurgeHandler(makeJobContext());

      // Invoice (retained): cutoff is the 4-year window — a row soft-deleted
      // 100 days ago is INSIDE the window (newer than cutoff) so it is NOT swept.
      const invoiceCutoff = cutoffOf(tx.invoice.deleteMany).getTime();
      expect(before - invoiceCutoff).toBeGreaterThan(FOUR_YEARS_MS - NINETY_DAYS_MS);
      const hundredDaysAgo = before - 100 * 24 * 60 * 60 * 1000;
      expect(hundredDaysAgo).toBeGreaterThan(invoiceCutoff); // in-window → retained

      // Contract (non-retained): keeps the flat 90-day cutoff (default preserved).
      // Tolerance covers the calendar `setDate` vs fixed-ms drift (incl. DST hour).
      const contractCutoff = cutoffOf(tx.contract.deleteMany).getTime();
      expect(Math.abs(before - NINETY_DAYS_MS - contractCutoff)).toBeLessThan(3 * 60 * 60 * 1000);
    });

    it('PURGES after window: a retained row past its 4yr window IS swept; a non-retained row past 90d IS swept', async () => {
      mockGetRetentionCutoff.mockImplementation((model: string, now: Date) =>
        fixtureRetention(model, now),
      );
      const tx = makeTxStub({ invoice: 1, contractor: 2 });
      mockTransaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

      const before = Date.now();
      const result = await dataPurgeHandler(makeJobContext());

      // A row older than the 4-year invoice cutoff WOULD match the where filter.
      const invoiceCutoff = cutoffOf(tx.invoice.deleteMany).getTime();
      const fiveYearsAgo = before - 5 * 365 * 24 * 60 * 60 * 1000;
      expect(fiveYearsAgo).toBeLessThan(invoiceCutoff); // past window → purged

      // Non-retained contractor still purges past the flat 90 days.
      const contractorCutoff = cutoffOf(tx.contractor.deleteMany).getTime();
      expect(Math.abs(before - NINETY_DAYS_MS - contractorCutoff)).toBeLessThan(3 * 60 * 60 * 1000);

      const details = result.details as { purged: Record<string, number> };
      expect(details.purged).toMatchObject({ invoices: 1, contractors: 2 });
    });
  });
});
