/**
 * Unit tests for the `late-interest-pdf-reaper` cron handler.
 *
 * Coverage:
 *   1. No stuck claims → ok=true + scanned 0.
 *   2. Claim with a pdfKey → flipped to READY without a re-render (backfill).
 *   3. Claim without a pdfKey → re-published to QStash (requeued).
 *   4. QStash publish throws → requeueFailed > 0 → ok=false.
 *   5. Claim query throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClaimFindMany,
  mockClaimUpdate,
  mockClaimUpdateMany,
  mockPublishJSON,
  mockGetServerEnv,
  mockGauge,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockClaimFindMany: vi.fn(),
  mockClaimUpdate: vi.fn(),
  mockClaimUpdateMany: vi.fn(),
  mockPublishJSON: vi.fn(),
  mockGetServerEnv: vi.fn(),
  mockGauge: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    invoiceInterestClaim: {
      findMany: mockClaimFindMany,
      update: mockClaimUpdate,
      updateMany: mockClaimUpdateMany,
    },
  },
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: () => ({ publishJSON: mockPublishJSON }),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockGauge, increment: vi.fn() },
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: mockGetServerEnv,
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { lateInterestPdfReaperHandler } from '../jobs/handlers/late-interest-pdf-reaper.js';
import { makeJobContext } from './_helpers.js';

const STALE_DATE = new Date(Date.now() - 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  mockClaimFindMany.mockResolvedValue([]);
  mockClaimUpdate.mockResolvedValue({});
  mockClaimUpdateMany.mockResolvedValue({ count: 1 });
  mockPublishJSON.mockResolvedValue({ messageId: 'msg-1' });
  mockGetServerEnv.mockReturnValue({ NEXT_PUBLIC_APP_URL: 'https://app.test' });
});

describe('lateInterestPdfReaperHandler', () => {
  it('returns ok=true with scanned 0 when no claims are stuck', async () => {
    const result = await lateInterestPdfReaperHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 0, backfilled: 0, requeued: 0 });
  });

  it('backfills a claim that already has a pdfKey without re-rendering', async () => {
    mockClaimFindMany.mockResolvedValue([
      {
        id: 'claim-1',
        organizationId: 'org-1',
        pdfStatus: 'PENDING_RENDER',
        pdfKey: 'r2/claim-1.pdf',
        claimedAt: STALE_DATE,
      },
    ]);

    const result = await lateInterestPdfReaperHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 1, backfilled: 1, requeued: 0 });
    expect(mockClaimUpdate).toHaveBeenCalledTimes(1);
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it('re-publishes a keyless claim to QStash', async () => {
    mockClaimFindMany.mockResolvedValue([
      {
        id: 'claim-2',
        organizationId: 'org-1',
        pdfStatus: 'PENDING_RENDER',
        pdfKey: null,
        claimedAt: STALE_DATE,
      },
    ]);

    const result = await lateInterestPdfReaperHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 1, requeued: 1, requeueFailed: 0 });
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({ deduplicationId: 'late-interest-pdf:claim-2' }),
    );
  });

  it('returns ok=false when a QStash publish fails', async () => {
    mockClaimFindMany.mockResolvedValue([
      {
        id: 'claim-3',
        organizationId: 'org-1',
        pdfStatus: 'PENDING_RENDER',
        pdfKey: null,
        claimedAt: STALE_DATE,
      },
    ]);
    mockPublishJSON.mockRejectedValue(new Error('qstash 500'));

    const result = await lateInterestPdfReaperHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ requeued: 0, requeueFailed: 1 });
  });

  it('returns ok=false and reports to Sentry when the claim query throws', async () => {
    mockClaimFindMany.mockRejectedValue(new Error('neon timeout'));

    const result = await lateInterestPdfReaperHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'neon timeout' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
