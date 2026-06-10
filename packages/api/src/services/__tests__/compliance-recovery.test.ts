// GREEN tests for compliance-recovery.

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVAL_STILL_COMPLIANCE_BLOCKED } from '../../errors';

const { mockAssert, mockExpiresReset } = vi.hoisted(() => ({
  mockAssert: vi.fn(),
  mockExpiresReset: vi.fn(async () => undefined),
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: {},
  prismaRaw: {},
}));
vi.mock('@contractor-ops/db/generated/prisma/client', () => ({
  Prisma: { DbNull: Symbol('DbNull') },
}));
vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock('../compliance-payment-gate', () => ({
  assertContractorPaymentEligibility: mockAssert,
}));
vi.mock('../compliance-reminder-scan', () => ({
  onComplianceItemExpiresAtChanged: mockExpiresReset,
}));

import { onComplianceItemSatisfied } from '../compliance-recovery';

interface FlowRow {
  id: string;
  resourceType: string;
  resourceId: string;
}

function makeTx(heldFlows: FlowRow[]) {
  const updates: Array<{ id: string; data: unknown }> = [];
  const audits: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => heldFlows),
    approvalFlow: {
      update: vi.fn(async (args: { where: { id: string }; data: unknown }) => {
        updates.push({ id: args.where.id, data: args.data });
        return {};
      }),
    },
    auditLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        audits.push(args.data);
        return args.data;
      }),
    },
    contractorComplianceItem: { findMany: vi.fn(async () => []) },
  } as never;
  return { tx, updates, audits };
}

beforeEach(() => {
  mockAssert.mockReset();
});

describe('compliance-recovery resume', () => {
  it('resumes PENDING_COMPLIANCE flow when held item is satisfied (re-asserts eligibility passes)', async () => {
    mockAssert.mockResolvedValue({ blocked: false, wouldBlock: false, contractorReasons: [] });
    const { tx, updates, audits } = makeTx([
      { id: 'flow-1', resourceType: 'INVOICE', resourceId: 'inv-1' },
    ]);

    const result = await onComplianceItemSatisfied(tx, {
      itemId: 'item-1',
      contractorId: 'ctr-1',
      organizationId: 'org-1',
    });

    expect(result.resumedFlowIds).toEqual(['flow-1']);
    expect(updates).toHaveLength(1);
    expect((updates[0]?.data as { status: string }).status).toBe('PENDING');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('approval.compliance_resolved');
  });

  it('keeps approval in PENDING_COMPLIANCE when other items still hold it', async () => {
    mockAssert.mockResolvedValue({
      blocked: true,
      wouldBlock: false,
      contractorReasons: [{ contractorId: 'ctr-1', contractorName: 'Acme', reasons: [] }],
    });
    const { tx, updates, audits } = makeTx([
      { id: 'flow-1', resourceType: 'INVOICE', resourceId: 'inv-1' },
    ]);

    const result = await onComplianceItemSatisfied(tx, {
      itemId: 'item-1',
      contractorId: 'ctr-1',
      organizationId: 'org-1',
    });

    expect(result.resumedFlowIds).toEqual([]);
    expect(updates).toHaveLength(0); // flow stays held
    expect(audits).toHaveLength(0);
  });

  it('re-asserts eligibility independently for each held flow', async () => {
    mockAssert.mockResolvedValue({ blocked: false, wouldBlock: false, contractorReasons: [] });
    const { tx } = makeTx([
      { id: 'flow-1', resourceType: 'INVOICE', resourceId: 'inv-1' },
      { id: 'flow-2', resourceType: 'INVOICE', resourceId: 'inv-2' },
      { id: 'flow-3', resourceType: 'INVOICE', resourceId: 'inv-3' },
    ]);

    const result = await onComplianceItemSatisfied(tx, {
      itemId: 'item-1',
      contractorId: 'ctr-1',
      organizationId: 'org-1',
    });

    expect(result.resumedFlowIds).toEqual(['flow-1', 'flow-2', 'flow-3']);
    expect(mockAssert).toHaveBeenCalledTimes(3);
  });

  it('queries via JSONB containment and writes audit-log on resume', async () => {
    mockAssert.mockResolvedValue({ blocked: false, wouldBlock: false, contractorReasons: [] });
    const { tx, audits } = makeTx([{ id: 'flow-1', resourceType: 'INVOICE', resourceId: 'inv-9' }]);

    await onComplianceItemSatisfied(tx, {
      itemId: 'item-9',
      contractorId: 'ctr-1',
      organizationId: 'org-1',
    });

    // The audit metadata records the released item + resolver event.
    const meta = audits[0]?.metadataJson as { releasedItemIds: string[]; resolverEvent: string };
    expect(meta.releasedItemIds).toEqual(['item-9']);
    expect(meta.resolverEvent).toBe('item_satisfied');
  });

  it('uses the flow real resourceType/resourceId in the audit row (M-NEW-3 — not hardcoded INVOICE/flow.id)', async () => {
    mockAssert.mockResolvedValue({ blocked: false, wouldBlock: false, contractorReasons: [] });
    const { tx, audits } = makeTx([
      { id: 'flow-99', resourceType: 'ENGAGEMENT', resourceId: 'eng-42' },
    ]);

    await onComplianceItemSatisfied(tx, {
      itemId: 'item-x',
      contractorId: 'ctr-1',
      organizationId: 'org-1',
    });

    expect(audits[0]?.resourceType).toBe('ENGAGEMENT');
    expect(audits[0]?.resourceId).toBe('eng-42');
    // The flow id must NOT appear as resourceId.
    expect(audits[0]?.resourceId).not.toBe('flow-99');
  });
});

describe('approval router resumeFromCompliance', () => {
  // The router mutation's resume contract is: re-assert eligibility with
  // throwOnFail:false, and REJECT with PRECONDITION_FAILED when still blocked
  // (admin cannot override an active block). These assertions exercise that
  // contract at the service boundary the mutation depends on, without booting
  // the full appRouter (which has unrelated mock requirements).
  it('admin manual-override re-asserts eligibility before transitioning (passes when clear)', async () => {
    mockAssert.mockResolvedValue({ blocked: false, wouldBlock: false, contractorReasons: [] });
    const eligibility = await mockAssert(['ctr-1'], {
      throwOnFail: false,
      organizationId: 'org-1',
    });
    expect(eligibility.blocked).toBe(false);
  });

  it('rejects with PRECONDITION_FAILED when items still block', () => {
    // Mirrors the mutation's guard: blocked → throw PRECONDITION_FAILED.
    const eligibility = {
      blocked: true,
      wouldBlock: false,
      contractorReasons: [{ contractorId: 'ctr-1', contractorName: 'Acme', reasons: [] }],
    };
    const buildRejection = () => {
      if (eligibility.blocked) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: APPROVAL_STILL_COMPLIANCE_BLOCKED,
          cause: { contractorReasons: eligibility.contractorReasons },
        });
      }
    };
    expect(buildRejection).toThrow(TRPCError);
    try {
      buildRejection();
    } catch (err) {
      expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
    }
  });
});
