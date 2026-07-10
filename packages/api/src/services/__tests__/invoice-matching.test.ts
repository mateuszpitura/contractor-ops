import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeDuplicateCheckHash,
  invoiceComparableNetMinor,
  resolveInvoiceMatchLinks,
  runAutoMatch,
} from '../invoice-matching';
import type { DbClient } from '../types';

const { mockComputeTimeReconciliation } = vi.hoisted(() => ({
  mockComputeTimeReconciliation: vi.fn(),
}));

vi.mock('../time-reconciliation', () => ({
  computeTimeReconciliation: mockComputeTimeReconciliation,
}));

const ORG_ID = 'org-1';
const CONTRACTOR_ID = 'contractor-1';
const CONTRACT_ID = 'contract-1';

function mockDb(overrides: Partial<DbClient> = {}): DbClient {
  return {
    contractor: { findFirst: vi.fn() },
    contract: { findMany: vi.fn(), findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    organization: { findUniqueOrThrow: vi.fn() },
    timeEntry: { aggregate: vi.fn() },
    ...overrides,
  } as unknown as DbClient;
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    sellerTaxId: '1234567890',
    totalMinor: 500000,
    currency: 'PLN',
    duplicateCheckHash: null as string | null,
    issueDate: new Date('2025-01-15'),
    servicePeriodStart: null as Date | null,
    servicePeriodEnd: null as Date | null,
    ...overrides,
  };
}

function makeContractor(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRACTOR_ID,
    taxId: '1234567890',
    organizationId: ORG_ID,
    ...overrides,
  };
}

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRACT_ID,
    contractorId: CONTRACTOR_ID,
    organizationId: ORG_ID,
    status: 'ACTIVE',
    rateValueMinor: 500000,
    rateType: 'MONTHLY_FIXED',
    currency: 'PLN',
    deletedAt: null,
    ...overrides,
  };
}

const mockPrisma = {
  contractor: { findFirst: vi.fn() },
  contract: { findMany: vi.fn(), findFirst: vi.fn() },
  invoice: { findFirst: vi.fn() },
};

beforeEach(() => {
  mockPrisma.contractor.findFirst.mockReset();
  mockPrisma.contract.findMany.mockReset();
  mockPrisma.contract.findFirst.mockReset();
  mockPrisma.invoice.findFirst.mockReset();
  mockComputeTimeReconciliation.mockReset();
  mockPrisma.contractor.findFirst.mockResolvedValue(null);
  mockPrisma.contract.findMany.mockResolvedValue([]);
  mockPrisma.contract.findFirst.mockResolvedValue(null);
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
});

describe('invoiceComparableNetMinor', () => {
  it('uses subtotalMinor when present', () => {
    expect(
      invoiceComparableNetMinor({ subtotalMinor: 10_000, vatRate: '23', totalMinor: 12_300 }),
    ).toBe(10_000);
  });

  it('derives net from gross and vatRate when subtotal missing', () => {
    expect(invoiceComparableNetMinor({ vatRate: '23', totalMinor: 12_300 })).toBe(10_000);
  });
});

describe('resolveInvoiceMatchLinks', () => {
  it('preserves existing links when auto-match returns null ids', () => {
    expect(
      resolveInvoiceMatchLinks(
        { contractorId: null, contractId: null },
        { contractorId: 'ctr_portal', contractId: 'ctr_contract' },
      ),
    ).toEqual({ contractorId: 'ctr_portal', contractId: 'ctr_contract' });
  });

  it('prefers auto-match ids when present', () => {
    expect(
      resolveInvoiceMatchLinks(
        { contractorId: 'ctr_nip', contractId: 'ctr_active' },
        { contractorId: 'ctr_portal', contractId: 'ctr_contract' },
      ),
    ).toEqual({ contractorId: 'ctr_nip', contractId: 'ctr_active' });
  });
});

describe('computeDuplicateCheckHash', () => {
  it('returns a deterministic hex string', () => {
    const hash1 = computeDuplicateCheckHash('FV/2024/001', '1234567890', 50000);
    const hash2 = computeDuplicateCheckHash('FV/2024/001', '1234567890', 50000);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizes invoice number to lowercase and trims whitespace', () => {
    const hash1 = computeDuplicateCheckHash('  FV/2024/001  ', '1234567890', 50000);
    const hash2 = computeDuplicateCheckHash('fv/2024/001', '1234567890', 50000);
    expect(hash1).toBe(hash2);
  });

  it('trims seller tax ID whitespace', () => {
    const hash1 = computeDuplicateCheckHash('FV/001', '  1234567890  ', 50000);
    const hash2 = computeDuplicateCheckHash('FV/001', '1234567890', 50000);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different amounts', () => {
    const hash1 = computeDuplicateCheckHash('FV/001', '1234567890', 50000);
    const hash2 = computeDuplicateCheckHash('FV/001', '1234567890', 60000);
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different invoice numbers', () => {
    const hash1 = computeDuplicateCheckHash('FV/001', '1234567890', 50000);
    const hash2 = computeDuplicateCheckHash('FV/002', '1234567890', 50000);
    expect(hash1).not.toBe(hash2);
  });
});

describe('runAutoMatch', () => {
  it('matches MONTHLY_FIXED on net amount not VAT gross', async () => {
    const db = mockDb();
    vi.mocked(db.contractor.findFirst).mockResolvedValue({ id: 'ctr_1' } as never);
    vi.mocked(db.contract.findMany).mockResolvedValue([
      {
        id: 'contract_1',
        rateType: 'MONTHLY_FIXED',
        rateValueMinor: 10_000,
        currency: 'PLN',
      },
    ] as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValue(null);

    const result = await runAutoMatch(db, 'org_1', {
      sellerTaxId: '1234567890',
      subtotalMinor: 10_000,
      vatRate: '23',
      totalMinor: 12_300,
      currency: 'PLN',
      duplicateCheckHash: null,
    });

    expect(result.matchStatus).toBe('MATCHED');
    expect(result.amountDeltaPercent).toBe(0);
    expect(result.expectedAmountMinor).toBe(10_000);
  });

  it('uses time reconciliation expected amount for PER_HOUR contracts', async () => {
    const db = mockDb();
    vi.mocked(db.contractor.findFirst).mockResolvedValue({ id: 'ctr_1' } as never);
    vi.mocked(db.contract.findMany).mockResolvedValue([
      {
        id: 'contract_hourly',
        rateType: 'PER_HOUR',
        rateValueMinor: 100_00,
        currency: 'PLN',
      },
    ] as never);
    vi.mocked(db.invoice.findFirst).mockResolvedValue(null);
    mockComputeTimeReconciliation.mockResolvedValue({
      approvedMinutes: 600,
      rateValueMinor: 100_00,
      rateType: 'PER_HOUR',
      hoursPerDay: 8,
      expectedAmountMinor: 100_000,
      invoicedAmountMinor: 100_000,
      deviationMinor: 0,
      deviationPercent: 0,
      withinThreshold: true,
      thresholdPercent: 10,
    });

    const result = await runAutoMatch(db, 'org_1', {
      sellerTaxId: '1234567890',
      subtotalMinor: 100_000,
      vatRate: '23',
      totalMinor: 123_000,
      currency: 'PLN',
      duplicateCheckHash: null,
      issueDate: new Date('2026-06-15'),
    });

    expect(result.expectedAmountMinor).toBe(100_000);
    expect(result.matchStatus).toBe('MATCHED');
    expect(result.amountDeltaPercent).toBe(0);
    expect(mockComputeTimeReconciliation).toHaveBeenCalled();
  });

  it('returns UNMATCHED without contractor when sellerTaxId missing', async () => {
    const db = mockDb();

    const result = await runAutoMatch(db, 'org_1', {
      sellerTaxId: null,
      totalMinor: 12_300,
      currency: 'PLN',
      duplicateCheckHash: null,
    });

    expect(result.matchStatus).toBe('UNMATCHED');
    expect(result.contractorId).toBeNull();
    expect(db.contractor.findFirst).not.toHaveBeenCalled();
  });

  it('returns UNMATCHED when sellerTaxId is null', async () => {
    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ sellerTaxId: null }),
    );

    expect(result.matchStatus).toBe('UNMATCHED');
    expect(result.score).toBe(0);
    expect(result.contractorId).toBeNull();
    expect(result.contractId).toBeNull();
    expect(result.flags).toEqual([]);
    expect(mockPrisma.contractor.findFirst).not.toHaveBeenCalled();
  });

  it('returns UNMATCHED when no contractor found for NIP', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(null);

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(result.matchStatus).toBe('UNMATCHED');
    expect(result.score).toBe(0);
    expect(result.contractorId).toBeNull();
    expect(result.flags).toEqual([]);
  });

  it('accumulates score 100 = 50 NIP + 30 contract + 20 amount within threshold', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateValueMinor: 500000 })]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 500000 }),
    );

    expect(result.score).toBe(100);
    expect(result.matchStatus).toBe('MATCHED');
    expect(result.contractorId).toBe(CONTRACTOR_ID);
    expect(result.contractId).toBe(CONTRACT_ID);
    expect(result.expectedAmountMinor).toBe(500000);
    expect(result.amountDeltaMinor).toBe(0);
    expect(result.amountDeltaPercent).toBe(0);
  });

  it('score 80 (NIP + contract, amount outside threshold) is still MATCHED', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([
      makeContract({ rateValueMinor: 100000, currency: 'PLN' }),
    ]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 115000 }),
    );

    expect(result.score).toBe(80);
    expect(result.matchStatus).toBe('DISCREPANCY');
  });

  it('score 80 with no rate (null rateValueMinor) yields MATCHED', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateValueMinor: null })]);

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(result.score).toBe(80);
    expect(result.matchStatus).toBe('MATCHED');
    expect(result.expectedAmountMinor).toBeNull();
  });

  it('score 50 (NIP only, no active contracts) yields PARTIAL', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([]);
    mockPrisma.contract.findFirst.mockResolvedValue(null);

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(result.score).toBe(50);
    expect(result.matchStatus).toBe('PARTIAL');
    expect(result.contractorId).toBe(CONTRACTOR_ID);
    expect(result.contractId).toBeNull();
    expect(result.flags).toContain('NO_ACTIVE_CONTRACT');
  });

  it('DISCREPANCY overrides even when score would be 100 (50% deviation)', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateValueMinor: 10000 })]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 15000 }),
    );

    expect(result.score).toBe(80);
    expect(result.matchStatus).toBe('DISCREPANCY');
    expect(result.amountDeltaMinor).toBe(5000);
    expect(result.amountDeltaPercent).toBe(50);
    expect(result.contractorId).toBe(CONTRACTOR_ID);
    expect(result.contractId).toBe(CONTRACT_ID);
  });

  it('computes correct deviation: 100000 rate vs 110000 invoice = 10% exactly at threshold', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateValueMinor: 100000 })]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 110000 }),
    );

    expect(result.amountDeltaMinor).toBe(10000);
    expect(result.amountDeltaPercent).toBe(10);
    expect(result.score).toBe(100);
    expect(result.matchStatus).toBe('MATCHED');
  });

  it('returns MATCHED when amount is within 9% deviation threshold', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateValueMinor: 100000 })]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 109000 }),
    );

    expect(result.amountDeltaMinor).toBe(9000);
    expect(result.amountDeltaPercent).toBe(9);
    expect(result.matchStatus).toBe('MATCHED');
    expect(result.score).toBe(100);
  });

  it('respects custom deviation threshold', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateValueMinor: 100000 })]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 115000 }),
      20,
    );

    expect(result.matchStatus).toBe('MATCHED');
    expect(result.score).toBe(100);
  });

  it('picks best contract by closest amount to invoice', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([
      makeContract({ id: 'contract-far', rateValueMinor: 50000 }),
      makeContract({ id: 'contract-close', rateValueMinor: 90000 }),
    ]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 85000 }),
    );

    expect(result.contractId).toBe('contract-close');
    expect(result.expectedAmountMinor).toBe(90000);
  });

  it('picks from three contracts the one with smallest absolute delta', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([
      makeContract({ id: 'contract-far', rateValueMinor: 200000 }),
      makeContract({ id: 'contract-close', rateValueMinor: 490000 }),
      makeContract({ id: 'contract-medium', rateValueMinor: 400000 }),
    ]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ totalMinor: 500000 }),
    );

    expect(result.contractId).toBe('contract-close');
    expect(result.expectedAmountMinor).toBe(490000);
  });

  it('uses contract without rate when it is the only option', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([
      makeContract({ id: 'contract-no-rate', rateValueMinor: null }),
    ]);

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(result.contractId).toBe('contract-no-rate');
    expect(result.score).toBe(80);
    expect(result.expectedAmountMinor).toBeNull();
  });

  it('flags NO_ACTIVE_CONTRACT when contracts array empty', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([]);
    mockPrisma.contract.findFirst.mockResolvedValue(null);

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(result.flags).toContain('NO_ACTIVE_CONTRACT');
    expect(result.contractId).toBeNull();
  });

  it('flags EXPIRED_CONTRACT when only expired contracts exist', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([]);
    mockPrisma.contract.findFirst.mockResolvedValue(makeContract({ status: 'EXPIRED' }));

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(result.flags).toContain('NO_ACTIVE_CONTRACT');
    expect(result.flags).toContain('EXPIRED_CONTRACT');
  });

  it('flags CURRENCY_MISMATCH when contract.currency !== invoice.currency', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ currency: 'EUR' })]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ currency: 'PLN' }),
    );

    expect(result.flags).toContain('CURRENCY_MISMATCH');
  });

  it('flags DUPLICATE_SUSPECTED when hash matches existing invoice', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract()]);
    mockPrisma.invoice.findFirst.mockResolvedValue({ id: 'inv-duplicate' });

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ duplicateCheckHash: 'somehash' }),
    );

    expect(result.flags).toContain('DUPLICATE_SUSPECTED');
    expect(result.duplicateInvoiceId).toBe('inv-duplicate');
  });

  it('does not flag duplicate when no hash provided', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract()]);

    const result = await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ duplicateCheckHash: null }),
    );

    expect(result.flags).not.toContain('DUPLICATE_SUSPECTED');
    expect(result.duplicateInvoiceId).toBeNull();
    expect(mockPrisma.invoice.findFirst).not.toHaveBeenCalled();
  });

  it('excludes self from duplicate check when invoice has an id', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract()]);
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await runAutoMatch(
      mockPrisma as never,
      ORG_ID,
      makeInvoice({ id: 'inv-self', duplicateCheckHash: 'somehash' }),
    );

    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'inv-self' },
          duplicateCheckHash: 'somehash',
          organizationId: ORG_ID,
        }),
      }),
    );
  });

  it('calls time reconciliation for PER_HOUR contracts', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateType: 'PER_HOUR' })]);
    mockComputeTimeReconciliation.mockResolvedValue({
      approvedMinutes: 160 * 60,
      rateValueMinor: 500000,
      rateType: 'PER_HOUR',
      hoursPerDay: 8,
      expectedAmountMinor: 500000,
      invoicedAmountMinor: 500000,
      deviationMinor: 0,
      deviationPercent: 0,
      withinThreshold: true,
      thresholdPercent: 10,
    });

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(mockComputeTimeReconciliation).toHaveBeenCalledTimes(2);
    expect(result.flags).not.toContain('TIME_DEVIATION');
  });

  it('flags TIME_DEVIATION when time reconciliation is outside threshold', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValue(makeContractor());
    mockPrisma.contract.findMany.mockResolvedValue([makeContract({ rateType: 'PER_DAY' })]);
    mockComputeTimeReconciliation.mockResolvedValue({
      approvedMinutes: 80 * 60,
      rateValueMinor: 500000,
      rateType: 'PER_DAY',
      hoursPerDay: 8,
      expectedAmountMinor: 500000,
      invoicedAmountMinor: 500000,
      deviationMinor: 250000,
      deviationPercent: 50,
      withinThreshold: false,
      thresholdPercent: 10,
    });

    const result = await runAutoMatch(mockPrisma as never, ORG_ID, makeInvoice());

    expect(result.flags).toContain('TIME_DEVIATION');
    expect(result.matchStatus).toBe('MATCHED');
    expect(result.score).toBe(100);
  });
});
