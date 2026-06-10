// compliance-dashboard helper tests.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  contractorComplianceItem: { findMany: vi.fn(), count: vi.fn() },
  paymentRun: { findMany: vi.fn() },
  paymentRunComplianceCheck: { findMany: vi.fn() },
};

vi.mock('@contractor-ops/db', () => ({ prisma: mockDb, prismaRaw: mockDb }));
vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));
vi.mock('../compliance-payment-gate.js', () => ({
  assertContractorPaymentEligibility: vi.fn(async () => ({
    blocked: false,
    wouldBlock: false,
    contractorReasons: [],
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.contractorComplianceItem.findMany.mockResolvedValue([]);
  mockDb.contractorComplianceItem.count.mockResolvedValue(0);
  mockDb.paymentRun.findMany.mockResolvedValue([]);
  mockDb.paymentRunComplianceCheck.findMany.mockResolvedValue([]);
});

describe('compliance-dashboard countAtRiskContractors', () => {
  it('counts BLOCKING + non-WAIVED items in MISSING/EXPIRED status or SATISFIED within 30d', async () => {
    mockDb.contractorComplianceItem.findMany.mockResolvedValueOnce([
      { contractorId: 'c1' },
      { contractorId: 'c2' },
    ]);
    const { countAtRiskContractors } = await import('../compliance-dashboard.js');
    const out = await countAtRiskContractors(mockDb as never, 'org_1');
    expect(out).toBe(2);
    expect(mockDb.contractorComplianceItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org_1',
          severity: 'BLOCKING',
          NOT: { status: 'WAIVED' },
        }),
        distinct: ['contractorId'],
      }),
    );
  });

  it('excludes WAIVED items from the at-risk count', async () => {
    const { countAtRiskContractors } = await import('../compliance-dashboard.js');
    await countAtRiskContractors(mockDb as never, 'org_1');
    const call = mockDb.contractorComplianceItem.findMany.mock.calls.at(-1) as
      | [{ where: { NOT: { status: string } } }]
      | undefined;
    expect(call?.[0].where.NOT.status).toBe('WAIVED');
  });
});

describe('compliance-dashboard listAtRiskItems', () => {
  it('returns items with severity=BLOCKING + status filter matching D-02 SQL', async () => {
    const { listAtRiskItems } = await import('../compliance-dashboard.js');
    await listAtRiskItems(mockDb as never, 'org_1');
    const call = mockDb.contractorComplianceItem.findMany.mock.calls.at(-1) as
      | [{ where: { severity: string; OR: unknown }; orderBy: unknown }]
      | undefined;
    expect(call?.[0].where.severity).toBe('BLOCKING');
    expect(call?.[0].where.OR).toBeDefined();
    expect(call?.[0].orderBy).toEqual([{ status: 'desc' }, { expiresAt: 'asc' }]);
  });
});

describe('compliance-dashboard listUpcomingRenewals', () => {
  it('returns items with status=SATISFIED + expiresAt within 90d, ordered by expiresAt ASC', async () => {
    const { listUpcomingRenewals } = await import('../compliance-dashboard.js');
    await listUpcomingRenewals(mockDb as never, 'org_1');
    const call = mockDb.contractorComplianceItem.findMany.mock.calls.at(-1) as
      | [{ where: { status: string }; orderBy: unknown }]
      | undefined;
    expect(call?.[0].where.status).toBe('SATISFIED');
    expect(call?.[0].orderBy).toEqual({ expiresAt: 'asc' });
  });
});

describe('compliance-dashboard listBlockedPayments', () => {
  it('merges live (assertContractorPaymentEligibility) + 7-day historical (PaymentRunComplianceCheck FAIL) sources', async () => {
    const gate = await import('../compliance-payment-gate.js');
    (
      gate.assertContractorPaymentEligibility as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      blocked: false,
      wouldBlock: true,
      contractorReasons: [{ contractorId: 'c1', contractorName: 'A', reasons: [] }],
    });
    mockDb.paymentRun.findMany.mockResolvedValueOnce([
      { id: 'r1', items: [{ contractorId: 'c1' }] },
    ]);
    mockDb.paymentRunComplianceCheck.findMany.mockResolvedValueOnce([
      {
        contractorId: 'c2',
        paymentRunId: 'r2',
        snapshottedAt: new Date(),
        snapshotJson: { reasons: [] },
      },
    ]);

    const { listBlockedPayments } = await import('../compliance-dashboard.js');
    const out = await listBlockedPayments(mockDb as never, 'org_1');
    expect(out.map(r => r.contractorId).sort()).toEqual(['c1', 'c2']);
    expect(out.find(r => r.contractorId === 'c1')?.source).toBe('live');
    expect(out.find(r => r.contractorId === 'c2')?.source).toBe('historical');
  });

  it('dedups by contractorId across the two sources (live wins)', async () => {
    const gate = await import('../compliance-payment-gate.js');
    (
      gate.assertContractorPaymentEligibility as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      blocked: false,
      wouldBlock: true,
      contractorReasons: [{ contractorId: 'c1', contractorName: 'A', reasons: [] }],
    });
    mockDb.paymentRun.findMany.mockResolvedValueOnce([
      { id: 'r1', items: [{ contractorId: 'c1' }] },
    ]);
    mockDb.paymentRunComplianceCheck.findMany.mockResolvedValueOnce([
      {
        contractorId: 'c1',
        paymentRunId: 'r2',
        snapshottedAt: new Date(),
        snapshotJson: { reasons: [] },
      },
    ]);
    const { listBlockedPayments } = await import('../compliance-dashboard.js');
    const out = await listBlockedPayments(mockDb as never, 'org_1');
    expect(out).toHaveLength(1);
    expect(out[0]?.contractorId).toBe('c1');
    expect(out[0]?.source).toBe('live');
  });
});
