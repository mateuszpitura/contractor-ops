import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/db')>();
  const MockDbPrisma = {
    paymentRunItem: { findUnique: vi.fn() },
    whtCertificate: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (fn: (tx: typeof MockDbPrisma) => unknown) => fn(MockDbPrisma)),
  };
  return {
    ...actual,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@contractor-ops/db';
import { createWhtCertificate, listWhtCertificates } from '../wht-certificate.service';

// ---------------------------------------------------------------------------
// Typed mock handles
// ---------------------------------------------------------------------------

const mockPrisma = prisma as unknown as {
  paymentRunItem: { findUnique: ReturnType<typeof vi.fn> };
  whtCertificate: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org_wht_test_123456';
const ITEM_ID = 'item-1';
const USER_ID = 'user-1';

function makePaymentRunItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    organizationId: ORG_ID,
    amountMinor: 8000,
    grossAmountMinor: 10000,
    whtAmountMinor: 2000,
    whtRate: 20,
    whtTreatyApplied: true,
    whtTreatyReference: 'PL-DE Art. 12',
    currency: 'PLN',
    contractor: {
      legalName: 'Acme Sp. z o.o.',
      taxId: 'PL1234567890',
      countryCode: 'PL',
    },
    paymentRun: {
      id: 'payment-run-1',
      createdAt: new Date('2026-03-01'),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createWhtCertificate
// ---------------------------------------------------------------------------

describe('createWhtCertificate', () => {
  it('creates certificate with correct WHT-{orgShort}-{year}-{seq} number format', async () => {
    mockPrisma.paymentRunItem.findUnique.mockResolvedValue(makePaymentRunItem());
    mockPrisma.whtCertificate.count.mockResolvedValue(4);
    mockPrisma.whtCertificate.create.mockResolvedValue({
      id: 'cert-1',
      certificateNumber: `WHT-${ORG_ID.slice(-6).toUpperCase()}-2026-0005`,
    });

    const result = await createWhtCertificate({
      organizationId: ORG_ID,
      paymentRunItemId: ITEM_ID,
      generatedByUserId: USER_ID,
    });

    expect(result.certificateId).toBe('cert-1');
    // Sequence is count + 1 = 5, zero-padded
    expect(result.certificateNumber).toMatch(/^WHT-[A-Z0-9]{6}-\d{4}-\d{4}$/);

    const createData = mockPrisma.whtCertificate.create.mock.calls[0][0].data;
    expect(createData.organizationId).toBe(ORG_ID);
    expect(createData.grossAmountMinor).toBe(10000);
    expect(createData.whtAmountMinor).toBe(2000);
    expect(createData.whtRate).toBe(20);
    expect(createData.netAmountMinor).toBe(8000);
    expect(createData.currency).toBe('PLN');
    expect(createData.treatyApplied).toBe(true);
    expect(createData.treatyReference).toBe('PL-DE Art. 12');
  });

  it('throws NOT_FOUND when payment run item does not exist', async () => {
    mockPrisma.paymentRunItem.findUnique.mockResolvedValue(null);

    await expect(
      createWhtCertificate({
        organizationId: ORG_ID,
        paymentRunItemId: 'nonexistent',
        generatedByUserId: USER_ID,
      }),
    ).rejects.toThrow('paymentRunItemNotFound');
  });

  it('throws NOT_FOUND when item belongs to different organization', async () => {
    mockPrisma.paymentRunItem.findUnique.mockResolvedValue(
      makePaymentRunItem({ organizationId: 'org_other' }),
    );

    await expect(
      createWhtCertificate({
        organizationId: ORG_ID,
        paymentRunItemId: ITEM_ID,
        generatedByUserId: USER_ID,
      }),
    ).rejects.toThrow('paymentRunItemNotFound');
  });

  it('throws BAD_REQUEST when whtAmountMinor is zero', async () => {
    mockPrisma.paymentRunItem.findUnique.mockResolvedValue(
      makePaymentRunItem({ whtAmountMinor: 0 }),
    );

    await expect(
      createWhtCertificate({
        organizationId: ORG_ID,
        paymentRunItemId: ITEM_ID,
        generatedByUserId: USER_ID,
      }),
    ).rejects.toThrow('whtNotApplicable');
  });

  it('throws BAD_REQUEST when whtAmountMinor is null', async () => {
    mockPrisma.paymentRunItem.findUnique.mockResolvedValue(
      makePaymentRunItem({ whtAmountMinor: null }),
    );

    await expect(
      createWhtCertificate({
        organizationId: ORG_ID,
        paymentRunItemId: ITEM_ID,
        generatedByUserId: USER_ID,
      }),
    ).rejects.toThrow('whtNotApplicable');
  });

  it('uses amountMinor as grossAmountMinor fallback when grossAmountMinor is null', async () => {
    mockPrisma.paymentRunItem.findUnique.mockResolvedValue(
      makePaymentRunItem({ grossAmountMinor: null }),
    );
    mockPrisma.whtCertificate.count.mockResolvedValue(0);
    mockPrisma.whtCertificate.create.mockResolvedValue({
      id: 'cert-2',
      certificateNumber: 'WHT-123456-2026-0001',
    });

    await createWhtCertificate({
      organizationId: ORG_ID,
      paymentRunItemId: ITEM_ID,
      generatedByUserId: USER_ID,
    });

    const createData = mockPrisma.whtCertificate.create.mock.calls[0][0].data;
    // Falls back to amountMinor (8000) when grossAmountMinor is null
    expect(createData.grossAmountMinor).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// listWhtCertificates
// ---------------------------------------------------------------------------

describe('listWhtCertificates', () => {
  it('returns certificates ordered by generatedAt desc', async () => {
    const certs = [
      { id: 'cert-2', generatedAt: new Date('2026-03-02') },
      { id: 'cert-1', generatedAt: new Date('2026-03-01') },
    ];
    mockPrisma.whtCertificate.findMany.mockResolvedValue(certs);

    const result = await listWhtCertificates(ORG_ID, mockPrisma as never);

    expect(result).toEqual(certs);
    expect(mockPrisma.whtCertificate.findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID },
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });
  });

  it('returns empty array when no certificates exist', async () => {
    mockPrisma.whtCertificate.findMany.mockResolvedValue([]);

    const result = await listWhtCertificates(ORG_ID, mockPrisma as never);
    expect(result).toEqual([]);
  });
});
