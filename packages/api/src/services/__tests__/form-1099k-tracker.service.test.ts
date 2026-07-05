// Form 1099-K band tracker — Wave-0 RED scaffold.
//
// `form-1099k-tracker.service` does not exist yet, so importing it fails at
// resolution and this suite is terminal-RED until the tracker lands. The
// assertions pin the informational-tracker contract, mirroring the shipped
// economic-dependency-scan sibling:
//   - the band transitions SAFE → APPROACHING → OVER against a tax-year-keyed
//     config of $20,000 AND 200 transactions (the OBBBA figures — NOT the stale
//     $5,000 / $600 threshold);
//   - a same-band re-fire is suppressed until the reminder cadence elapses
//     (lastReminderAt dedup);
//   - the scan is purely informational and NEVER files a 1099-K.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The scan test below drives the real `processContractor` path, which upserts
// tracker state and (on a crossing) enqueues the heads-up into the transactional
// outbox. Mock the DB + recipient resolution + outbox producer so the enqueue is
// observable; the pure-function suites above touch none of these.
const { mockPrismaRaw, txClient } = vi.hoisted(() => {
  const txClient = {
    form1099KTrackerState: { upsert: vi.fn(async () => ({})) },
  };
  const mockPrismaRaw = {
    tax1099KThreshold: { findUnique: vi.fn() },
    paymentRunItem: { groupBy: vi.fn() },
    form1099KTrackerState: { findUnique: vi.fn(async () => null) },
    contractor: { findUnique: vi.fn(async () => ({ displayName: 'Acme LLC' })) },
    $transaction: vi.fn(async (fn: (tx: typeof txClient) => unknown) => fn(txClient)),
  };
  return { mockPrismaRaw, txClient };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrismaRaw,
  prismaRaw: mockPrismaRaw,
}));

vi.mock('../rbac-recipients', () => ({
  resolveRbacRecipients: vi.fn(async () => ['admin-1']),
}));

vi.mock('../outbox', () => ({
  enqueueNotificationDispatch: vi.fn(async () => 'oxe_test_1'),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

import type { Form1099KBand, Form1099KThresholdConfig } from '../form-1099k-tracker.service';
import {
  bandFor1099K,
  runForm1099KTrackerScan,
  updateTrackerBandState,
} from '../form-1099k-tracker.service';
import { enqueueNotificationDispatch } from '../outbox';
import { resolveRbacRecipients } from '../rbac-recipients';

// OBBBA TY2026 threshold config: $20,000 gross AND 200 transactions.
const TY2026_CONFIG: Form1099KThresholdConfig = {
  taxYear: 2026,
  amountThresholdMinor: 2_000_000,
  transactionCountThreshold: 200,
};

describe('bandFor1099K — $20,000 + 200 transaction thresholds (OBBBA, not $5K/$600)', () => {
  it('is SAFE well below the threshold', () => {
    const band: Form1099KBand = bandFor1099K(
      { cumulativePayoutMinor: 500_000, transactionCount: 40 },
      TY2026_CONFIG,
    );
    expect(band).toBe('SAFE');
  });

  it('is APPROACHING as the payout nears the $20,000 threshold', () => {
    const band = bandFor1099K(
      { cumulativePayoutMinor: 1_800_000, transactionCount: 190 },
      TY2026_CONFIG,
    );
    expect(band).toBe('APPROACHING');
  });

  it('is OVER once both the $20,000 and the 200-transaction thresholds are crossed', () => {
    const band = bandFor1099K(
      { cumulativePayoutMinor: 2_100_000, transactionCount: 205 },
      TY2026_CONFIG,
    );
    expect(band).toBe('OVER');
  });

  it('does NOT treat the stale $600 figure as OVER', () => {
    const band = bandFor1099K(
      { cumulativePayoutMinor: 60_000, transactionCount: 3 },
      TY2026_CONFIG,
    );
    expect(band).toBe('SAFE');
  });
});

describe('updateTrackerBandState — same-band re-fire suppression', () => {
  it('suppresses a re-fire inside the reminder cadence via lastReminderAt', () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    const result = updateTrackerBandState(
      { currentBand: 'APPROACHING', lastReminderAt: new Date('2026-06-09T00:00:00.000Z') },
      'APPROACHING',
      now,
    );
    expect(result.emitted).toBe(false);
  });

  it('re-fires once the reminder cadence has elapsed', () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    const result = updateTrackerBandState(
      { currentBand: 'APPROACHING', lastReminderAt: new Date('2026-06-01T00:00:00.000Z') },
      'APPROACHING',
      now,
    );
    expect(result.emitted).toBe(true);
  });
});

describe('1099-K tracker — informational-only invariant', () => {
  it('the tracker service exports no filing entry point (it never files a 1099-K)', async () => {
    const mod = await import('../form-1099k-tracker.service');
    const surface = Object.keys(mod);
    expect(surface.some(name => /file|generate|transmit|submit/i.test(name))).toBe(false);
  });
});

describe('runForm1099KTrackerScan — heads-up rides inside the tracker-state tx', () => {
  const TY2026_THRESHOLD = {
    taxYear: 2026,
    amountThresholdMinor: 2_000_000,
    transactionCountThreshold: 200,
  };
  const NOW = new Date('2026-06-01T00:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaRaw.tax1099KThreshold.findUnique.mockResolvedValue(TY2026_THRESHOLD);
    mockPrismaRaw.form1099KTrackerState.findUnique.mockResolvedValue(null);
    mockPrismaRaw.contractor.findUnique.mockResolvedValue({ displayName: 'Acme LLC' });
    vi.mocked(resolveRbacRecipients).mockResolvedValue(['admin-1']);
  });

  it('upserts state and enqueues tax.form_1099k_over on an OVER up-crossing', async () => {
    mockPrismaRaw.paymentRunItem.groupBy.mockResolvedValue([
      {
        contractorId: 'c-1',
        organizationId: 'org-1',
        _sum: { amountMinor: 2_100_000 },
        _count: { _all: 205 },
      },
    ]);

    const result = await runForm1099KTrackerScan(NOW);

    expect(result).toMatchObject({ scanned: 1, notificationsDispatched: 1 });
    // The band-state upsert ran on the tx client.
    expect(txClient.form1099KTrackerState.upsert).toHaveBeenCalledOnce();
    // The heads-up was enqueued on the SAME tx client — atomic with the upsert.
    expect(enqueueNotificationDispatch).toHaveBeenCalledOnce();
    const enqueueArg = vi.mocked(enqueueNotificationDispatch).mock.calls[0]?.[0];
    expect(enqueueArg?.tx).toBe(txClient);
    expect(enqueueArg?.event).toMatchObject({
      type: 'tax.form_1099k_over',
      entityType: 'CONTRACTOR',
      entityId: 'c-1',
      recipientUserIds: ['admin-1'],
    });
  });

  it('upserts state but enqueues nothing when the band stays SAFE', async () => {
    mockPrismaRaw.paymentRunItem.groupBy.mockResolvedValue([
      {
        contractorId: 'c-1',
        organizationId: 'org-1',
        _sum: { amountMinor: 100_000 },
        _count: { _all: 5 },
      },
    ]);

    await runForm1099KTrackerScan(NOW);

    expect(txClient.form1099KTrackerState.upsert).toHaveBeenCalledOnce();
    expect(enqueueNotificationDispatch).not.toHaveBeenCalled();
  });
});
