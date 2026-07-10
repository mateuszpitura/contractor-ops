// An EXPIRED free-zone `ContractorComplianceItem` (severity BLOCKING, status
// EXPIRED, policyRuleId 'uae.free_zone_license@v2', documentType
// UAE_FREE_ZONE_LICENSE) causes `assertContractorPaymentEligibility` to
// hard-block payment for an ME-region (UAE) contractor.
//
// This is the money gate: a false-negative pays a non-compliant contractor.
// Analog: packages/api/src/services/__tests__/compliance-payment-gate.test.ts
// (the BLOCKING+EXPIRED findMany the gate selects on).

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFreeZoneComplianceItem, makeMeOrg } from './__fixtures__/gulf-fixtures';

const { mockPrisma, itemsFixture } = vi.hoisted(() => {
  const itemsFixture: Record<string, unknown>[] = [];
  const mockPrisma = {
    contractorComplianceItem: {
      // The gate selects severity='BLOCKING' AND status='EXPIRED'; the mock honours
      // those filters so a PENDING free-zone item does NOT surface here.
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return itemsFixture.filter(row => {
          if (where.severity && row.severity !== where.severity) return false;
          const statusFilter = where.status as string | { in?: string[] } | undefined;
          if (typeof statusFilter === 'string' && row.status !== statusFilter) return false;
          if (statusFilter && typeof statusFilter === 'object' && 'in' in statusFilter) {
            if (!statusFilter.in?.includes(row.status as string)) return false;
          }
          return true;
        });
      }),
    },
    auditLog: { create: vi.fn(async (a: { data: unknown }) => a.data) },
  };
  return { mockPrisma, itemsFixture };
});

vi.mock('@contractor-ops/db', () => ({ prisma: mockPrisma, prismaRaw: mockPrisma }));
vi.mock('@contractor-ops/feature-flags', () => ({ isPaymentBlockEnforced: vi.fn(() => true) }));
vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { assertContractorPaymentEligibility } from '../services/compliance-payment-gate';

const ME_ORG = makeMeOrg();

/** Shape the gulf fixture into the row the gate's findMany returns (joins contractor). */
function gateRow(over: Parameters<typeof makeFreeZoneComplianceItem>[0] = {}) {
  const item = makeFreeZoneComplianceItem({ organizationId: ME_ORG.id, ...over });
  return {
    ...item,
    contractor: {
      id: item.contractorId,
      displayName: 'Gulf Free-Zone Contractor',
      organizationId: ME_ORG.id,
    },
  };
}

beforeEach(() => {
  itemsFixture.length = 0;
  mockPrisma.contractorComplianceItem.findMany.mockClear();
});

describe('C1 (GULF-02) free-zone payment block — expired UAE_FREE_ZONE_LICENSE BLOCKING item', () => {
  it('blocks payment when an EXPIRED free-zone item (policyRuleId uae.free_zone_license@v2) exists for the contractor [79-03]', async () => {
    itemsFixture.push(gateRow({ status: 'EXPIRED' }));

    await expect(
      assertContractorPaymentEligibility(['clmectraaaaaaaaaaaaaaaaaaaa'], {
        organizationId: ME_ORG.id,
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    const where = mockPrisma.contractorComplianceItem.findMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;
    expect(where.severity).toBe('BLOCKING');
    expect(where.status).toEqual({ in: ['EXPIRED', 'MISSING'] });
  });

  it('surfaces the free-zone item in the PRECONDITION_FAILED cause.contractorReasons (deep-link to /contractors/:id/compliance) [79-03]', async () => {
    const item = makeFreeZoneComplianceItem({ organizationId: ME_ORG.id, status: 'EXPIRED' });
    itemsFixture.push(gateRow({ status: 'EXPIRED' }));

    try {
      await assertContractorPaymentEligibility([item.contractorId], { organizationId: ME_ORG.id });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      const cause = (err as TRPCError).cause as {
        contractorReasons: Array<{
          contractorId: string;
          reasons: Array<{
            policyRuleId: string | null;
            documentTypeLabelKey: string;
            deepLinkPath: string;
          }>;
        }>;
      };
      expect(cause.contractorReasons).toHaveLength(1);
      const reason = cause.contractorReasons[0]?.reasons[0];
      expect(reason?.policyRuleId).toBe('uae.free_zone_license@v2');
      // stableNamespace maps @v2 → uae.free_zone_license
      expect(reason?.documentTypeLabelKey).toBe(
        'Compliance.documentType.compliance-policy-engine.uae.free_zone_license',
      );
      expect(reason?.deepLinkPath).toBe(
        `/contractors/${item.contractorId}/compliance#item-${item.id}`,
      );
    }
  });

  it('does NOT block when the free-zone item is still PENDING (cascade only, not yet expired) [79-03]', async () => {
    itemsFixture.push(gateRow({ status: 'PENDING' }));

    const result = await assertContractorPaymentEligibility(['clmectraaaaaaaaaaaaaaaaaaaa'], {
      organizationId: ME_ORG.id,
    });
    expect(result).toEqual({ blocked: false, wouldBlock: false, contractorReasons: [] });
  });
});
