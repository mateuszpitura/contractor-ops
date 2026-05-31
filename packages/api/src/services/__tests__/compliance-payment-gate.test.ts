// Phase 72 Wave 2 — GREEN tests for compliance-payment-gate

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockIsPaymentBlockEnforced, mockWarn, mockError, itemsFixture, auditCreates } =
  vi.hoisted(() => {
    const itemsFixture: Record<string, unknown>[] = [];
    const auditCreates: Record<string, unknown>[] = [];

    const mockPrisma = {
      contractorComplianceItem: {
        findMany: vi.fn(async () => itemsFixture),
      },
      auditLog: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          auditCreates.push(args.data);
          return args.data;
        }),
      },
    };

    return {
      mockPrisma,
      mockIsPaymentBlockEnforced: vi.fn(() => true),
      mockWarn: vi.fn(),
      mockError: vi.fn(),
      itemsFixture,
      auditCreates,
    };
  });

vi.mock('@contractor-ops/db', () => ({ prisma: mockPrisma }));
vi.mock('@contractor-ops/feature-flags', () => ({
  isPaymentBlockEnforced: mockIsPaymentBlockEnforced,
}));
vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: mockWarn,
    error: mockError,
    debug: vi.fn(),
  })),
}));

import {
  assertContractorPaymentEligibility,
  getDocumentTypeLabelKey,
} from '../compliance-payment-gate';

const ORG = 'clorgaaaaaaaaaaaaaaaaaaaaaa';

function blockingExpiredItem(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: `item-${itemsFixture.length + 1}`,
    contractorId: 'ctr-1',
    policyRuleId: 'compliance-policy-engine.de.a1',
    documentType: 'A1_CERTIFICATE',
    severity: 'BLOCKING',
    status: 'EXPIRED',
    expiresAt: new Date('2026-04-01T00:00:00Z'),
    expiryJurisdictionTz: 'Europe/Berlin',
    contractor: { id: 'ctr-1', displayName: 'Acme GmbH', organizationId: ORG },
    ...over,
  };
}

beforeEach(() => {
  itemsFixture.length = 0;
  auditCreates.length = 0;
  mockPrisma.contractorComplianceItem.findMany.mockClear();
  mockPrisma.auditLog.create.mockClear();
  mockIsPaymentBlockEnforced.mockReset();
  mockIsPaymentBlockEnforced.mockReturnValue(true);
  mockWarn.mockClear();
  mockError.mockClear();
});

describe('compliance-payment-gate assertion', () => {
  it('throws PRECONDITION_FAILED with structured cause when contractor has BLOCKING+EXPIRED item', async () => {
    itemsFixture.push(blockingExpiredItem());
    await expect(
      assertContractorPaymentEligibility(['ctr-1'], { organizationId: ORG }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    // The cause carries the D-10 shape.
    try {
      await assertContractorPaymentEligibility(['ctr-1'], { organizationId: ORG });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      const cause = (err as TRPCError).cause as { contractorReasons: unknown[] };
      expect(cause.contractorReasons).toHaveLength(1);
      const cr = cause.contractorReasons[0] as {
        contractorId: string;
        contractorName: string;
        reasons: Array<{ itemId: string; documentTypeLabelKey: string; deepLinkPath: string }>;
      };
      expect(cr.contractorId).toBe('ctr-1');
      expect(cr.contractorName).toBe('Acme GmbH');
      expect(cr.reasons[0]?.documentTypeLabelKey).toBe(
        'compliance.documentType.compliance-policy-engine.de.a1',
      );
      expect(cr.reasons[0]?.deepLinkPath).toBe('/contractors/ctr-1/compliance#item-item-1');
    }
  });

  it('returns blocked=false when contractor has no BLOCKING+EXPIRED items (query returns empty)', async () => {
    // WARNING-severity / SATISFIED rows are excluded by the WHERE clause → findMany empty.
    const result = await assertContractorPaymentEligibility(['ctr-1'], { organizationId: ORG });
    expect(result).toEqual({ blocked: false, wouldBlock: false, contractorReasons: [] });
    const where = mockPrisma.contractorComplianceItem.findMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;
    expect(where.severity).toBe('BLOCKING');
    expect(where.status).toBe('EXPIRED');
  });

  it('returns immediately for an empty contractorIds array (no DB query)', async () => {
    const result = await assertContractorPaymentEligibility([], { organizationId: ORG });
    expect(result).toEqual({ blocked: false, wouldBlock: false, contractorReasons: [] });
    expect(mockPrisma.contractorComplianceItem.findMany).not.toHaveBeenCalled();
  });

  it('does not throw when throwOnFail is false, even if blocked', async () => {
    itemsFixture.push(blockingExpiredItem());
    const result = await assertContractorPaymentEligibility(['ctr-1'], {
      organizationId: ORG,
      throwOnFail: false,
    });
    expect(result.blocked).toBe(true);
    expect(result.contractorReasons).toHaveLength(1);
  });
});

describe('compliance-payment-gate flag-off', () => {
  it('flag OFF returns { blocked: false, wouldBlock: true } and emits WARN log + AuditLog', async () => {
    mockIsPaymentBlockEnforced.mockReturnValue(false);
    itemsFixture.push(blockingExpiredItem());

    const result = await assertContractorPaymentEligibility(['ctr-1'], { organizationId: ORG });

    expect(result.blocked).toBe(false);
    expect(result.wouldBlock).toBe(true);
    expect(result.contractorReasons).toHaveLength(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const warnArg = mockWarn.mock.calls[0]?.[0] as { event: string };
    expect(warnArg.event).toBe('compliance.payment.would_block');
    expect(auditCreates).toHaveLength(1);
    expect(auditCreates[0]?.action).toBe('compliance.payment.would_block');
  });

  it('flag ON with would_block flagEnabled override forces enforcement', async () => {
    itemsFixture.push(blockingExpiredItem());
    await expect(
      assertContractorPaymentEligibility(['ctr-1'], { organizationId: ORG, flagEnabled: true }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});

describe('compliance-payment-gate tx interop', () => {
  it('accepts an active tx and reads via the transaction client', async () => {
    const txFindMany = vi.fn(async () => []);
    const tx = {
      contractorComplianceItem: { findMany: txFindMany },
      auditLog: { create: vi.fn() },
    } as never;

    const result = await assertContractorPaymentEligibility(['ctr-1'], { tx, organizationId: ORG });

    expect(txFindMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.contractorComplianceItem.findMany).not.toHaveBeenCalled();
    expect(result.blocked).toBe(false);
  });
});

describe('getDocumentTypeLabelKey', () => {
  it('uses policyRuleId when present, falls back to lowercased documentType', () => {
    expect(getDocumentTypeLabelKey('A1_CERTIFICATE', 'compliance-policy-engine.de.a1')).toBe(
      'compliance.documentType.compliance-policy-engine.de.a1',
    );
    expect(getDocumentTypeLabelKey('A1_CERTIFICATE', null)).toBe(
      'compliance.documentType.a1_certificate',
    );
  });
});
