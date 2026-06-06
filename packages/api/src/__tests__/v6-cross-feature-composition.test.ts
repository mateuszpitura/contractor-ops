// Phase 80 · Plan 01 — SC#1 cross-feature composition (F1 + F3 + F4).
//
// This is the milestone's proof that the four v6.0 gate primitives — already
// independently unit-tested — actually COMPOSE on the SC#1 mega-scenario: ONE
// seeded ME-region (UAE) contractor carrying a free-zone BLOCKING license, a
// Saudi-national assignment, and an open IP_VERIFICATION offboarding task.
//
//   F1 + F3 (payment hard-block): a free-zone BLOCKING item recorded valid
//     (PENDING) crosses its Asia/Dubai expiry boundary; the region-aware
//     reminder scan flips it PENDING→EXPIRED on the SHARED mutable store, which
//     arms `assertContractorPaymentEligibility` to throw PRECONDITION_FAILED.
//   F3 (Saudization advisory): `projectOffboardingTrajectory` is advisory-only
//     and non-gating — it recomputes a projected RATE and NEVER asserts a band.
//   F4 (offboarding hard-block): an open IP_VERIFICATION task makes
//     `assertRunCompletable` throw PRECONDITION_FAILED with
//     cause.blockedTaskKind='IP_VERIFICATION'; a Phase-74 override clears it.
//   Audit (F1/F3 path): the payment gate's would-block path writes a
//     `compliance.payment.would_block` AuditLog row. The composed F4 hard-block
//     path (`assertRunCompletable`) writes NO audit row of its own.
//   Locked-phrase guard (green): the Gulf AE/SA locked phrases match verbatim.
//
// Seeded DB-free via the gulf-fixtures factories + a hoisted mock-Prisma store
// (the heavyweight live-DB dev seeder has no Gulf section and is intentionally
// unused here). Primary analog: free-zone-record-then-expire.test.ts (the test
// wiring REAL services end-to-end against one shared mutable store). F4 analog:
// workflow-execution-ip-block.test.ts. No feature source is modified.
//
// F2 (IdP deprovisioning) is deliberately NOT composed here (D-01): its
// ACCESS_REVOKE saga runs POST-offboarding-completion, off the blocked path, so
// it belongs only in 80-HUMAN-UAT.md.

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFreeZoneComplianceItem, makeMeOrg } from './__fixtures__/gulf-fixtures';

const ME_ORG = makeMeOrg();
const CONTRACTOR_ID = 'clmectraaaaaaaaaaaaaaaaaaaa';
// A SECOND synthetic tenant + contractor so the payment-gate where filters
// (contractorId.in + contractor.is.organizationId) are load-bearing, not decorative.
const OTHER_ORG_ID = 'clmeorgbbbbbbbbbbbbbbbbbbbb';
const OTHER_CONTRACTOR_ID = 'clmectrbbbbbbbbbbbbbbbbbbbb';

// The exhaustive key set of OffboardingTrajectoryResult. Asserting the trajectory
// has EXACTLY these keys guards the locked anti-feature: an advisory render must
// never grow a projected band (or any other) field.
const TRAJECTORY_KEYS = [
  'advisory',
  'authoritative',
  'currentBand',
  'currentRate',
  'projectedRate',
].sort();

interface ItemRow {
  id: string;
  organizationId: string;
  contractorId: string;
  documentType: string;
  name: string;
  severity: string;
  policyRuleId: string | null;
  status: string;
  expiresAt: Date | null;
  expiryJurisdictionTz: string | null;
  contractor: { id: string; displayName: string; organizationId: string };
}

const { store } = vi.hoisted(() => ({ store: { items: [] as Record<string, unknown>[] } }));

// The audit-writer spy is declared via vi.hoisted so it is the same reference the
// mocked module exposes AND the test asserts against. The F1/F3 gate path (the
// payment gate's would-block branch) is what populates the audit rows asserted
// here; the F4 hard-block leg (assertRunCompletable) adds no audit writer.
const { auditWriteSpy } = vi.hoisted(() => ({ auditWriteSpy: vi.fn(async () => undefined) }));

// Region client used by the reminder scan. Holds the shared mutable item store so
// a status flip persisted by reEvaluateFreeZoneStatus is visible to the gate.
function regionClientFactory(region: string) {
  return {
    contractorComplianceItem: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        if (region !== 'ME') return [];
        const where = args?.where ?? {};
        const statusIn = (where.status as { in?: string[] } | undefined)?.in;
        return store.items.filter(r => {
          if (where.severity && r.severity !== where.severity) return false;
          if (statusIn && !statusIn.includes(r.status as string)) return false;
          if (where.expiresAt && r.expiresAt == null) return false;
          if (where.expiryJurisdictionTz && r.expiryJurisdictionTz == null) return false;
          return true;
        });
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.items.find(r => r.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return row;
      }),
    },
    contractorComplianceReminderState: {
      findUnique: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async (a: { data: unknown }) => a.data),
    },
    organization: {
      findUnique: vi.fn(async () => ({ language: 'en' })),
    },
  };
}

const clientCache = new Map<string, ReturnType<typeof regionClientFactory>>();

vi.mock('@contractor-ops/db', () => ({
  // The gate falls back to `prisma` when no tx is passed; route it at the store too.
  prisma: {
    contractorComplianceItem: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return store.items.filter(r => {
          if (where.severity && r.severity !== where.severity) return false;
          if (where.status && r.status !== where.status) return false;
          // Mirror the real gate's contractorId/tenant scope (compliance-payment-gate.ts:86-99)
          // so the tenant-isolation assertions are load-bearing, not false-green (WR-02).
          const cid = (where.contractorId as { in?: string[] } | undefined)?.in;
          if (cid && !cid.includes(r.contractorId as string)) return false;
          const orgIs = (where.contractor as { is?: { organizationId?: string } } | undefined)?.is
            ?.organizationId;
          if (orgIs && r.organizationId !== orgIs) return false;
          return true;
        });
      }),
    },
  },
  prismaRaw: {},
  SUPPORTED_REGIONS: ['EU', 'ME'] as const,
  getRegionalClient: vi.fn((region: string) => {
    let c = clientCache.get(region);
    if (!c) {
      c = regionClientFactory(region);
      clientCache.set(region, c);
    }
    return c;
  }),
}));
vi.mock('@contractor-ops/feature-flags', () => ({ isPaymentBlockEnforced: vi.fn(() => true) }));
vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));
vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn(), distribution: vi.fn() },
}));
vi.mock('../services/notification-service', () => ({ dispatch: vi.fn(async () => undefined) }));
vi.mock('../services/rbac-recipients', () => ({
  resolveRbacRecipients: vi.fn(async () => ['user-admin-1']),
}));
vi.mock('../services/cron-dedup', () => ({ claimCronNotificationDedup: vi.fn(async () => true) }));
vi.mock('../services/audit-writer', () => ({ writeAuditLog: auditWriteSpy }));
vi.mock('../i18n/email-i18n', () => ({
  normalizeLocale: vi.fn(() => 'en'),
  resolveMessage: vi.fn((key: string) => key),
}));

import {
  LOCKED_AE_PHRASES,
  LOCKED_SA_PHRASES,
  RESERVED_AE_LEGAL_KEYS,
  RESERVED_SA_LEGAL_KEYS,
} from '@contractor-ops/validators';
import { assertRunCompletable } from '../routers/workflow/workflow-shared';
import { assertContractorPaymentEligibility } from '../services/compliance-payment-gate';
import { runComplianceReminderScan } from '../services/compliance-reminder-scan';
import { projectOffboardingTrajectory } from '../services/saudization-dashboard';

/** A PENDING free-zone BLOCKING item recorded while valid, expiring on `expiresAt`. */
function recordValidFreeZoneItem(expiresAt: Date): ItemRow {
  const fixture = makeFreeZoneComplianceItem({
    organizationId: ME_ORG.id,
    contractorId: CONTRACTOR_ID,
    expiresAt,
    status: 'PENDING',
  });
  const row: ItemRow = {
    id: fixture.id,
    organizationId: fixture.organizationId,
    contractorId: fixture.contractorId,
    documentType: fixture.documentType,
    name: fixture.name,
    severity: fixture.severity,
    policyRuleId: fixture.policyRuleId,
    status: fixture.status,
    expiresAt: fixture.expiresAt,
    expiryJurisdictionTz: fixture.expiryJurisdictionTz,
    contractor: {
      id: fixture.contractorId,
      displayName: 'Gulf Free-Zone Contractor',
      organizationId: fixture.organizationId,
    },
  };
  store.items.push(row as unknown as Record<string, unknown>);
  return row;
}

/**
 * A free-zone BLOCKING item for an arbitrary org/contractor — used to seed a
 * SECOND tenant's EXPIRED row so the gate's contractorId/organizationId where
 * filters are proven load-bearing (the second-tenant row must NOT leak into the
 * first tenant's contractorReasons).
 */
function recordFreeZoneItemFor(params: {
  id: string;
  organizationId: string;
  contractorId: string;
  expiresAt: Date;
  status: string;
}): ItemRow {
  const fixture = makeFreeZoneComplianceItem({
    id: params.id,
    organizationId: params.organizationId,
    contractorId: params.contractorId,
    expiresAt: params.expiresAt,
    status: params.status,
  });
  const row: ItemRow = {
    id: fixture.id,
    organizationId: fixture.organizationId,
    contractorId: fixture.contractorId,
    documentType: fixture.documentType,
    name: fixture.name,
    severity: fixture.severity,
    policyRuleId: fixture.policyRuleId,
    status: fixture.status,
    expiresAt: fixture.expiresAt,
    expiryJurisdictionTz: fixture.expiryJurisdictionTz,
    contractor: {
      id: fixture.contractorId,
      displayName: 'Other-Tenant Free-Zone Contractor',
      organizationId: fixture.organizationId,
    },
  };
  store.items.push(row as unknown as Record<string, unknown>);
  return row;
}

beforeEach(() => {
  store.items.length = 0;
  clientCache.clear();
  auditWriteSpy.mockClear();
});

describe('SC#1 — F1+F3+F4 compose on ONE seeded contractor (single shared store)', () => {
  // One coherent seeded context: the free-zone item, the offboarding headcount,
  // and the IP_VERIFICATION run all reference the SAME contractor/org so step 3's
  // advisory is derived from the seeded state, not disconnected literals.
  const SEEDED = {
    organizationId: ME_ORG.id,
    contractorId: CONTRACTOR_ID,
    workflowRunId: 'run_seeded_1',
    headcount: { totalHeadcount: 100, saudiHeadcount: 50 },
  };

  it('threads scan→EXPIRED → enforced payment hard-block → advisory from the same headcount → IP_VERIFICATION offboarding hard-block, with the OTHER-tenant row excluded', async () => {
    // Seed the SAME contractor's PENDING free-zone item plus a SECOND-tenant
    // EXPIRED BLOCKING row; the latter must be excluded by the gate where filters.
    const item = recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));
    recordFreeZoneItemFor({
      id: 'clmefzitemddddddddddddddddd',
      organizationId: OTHER_ORG_ID,
      contractorId: OTHER_CONTRACTOR_ID,
      expiresAt: new Date('2026-03-01T00:00:00Z'),
      status: 'EXPIRED',
    });

    // Step 1 (F1): the regional reminder scan crosses the Asia/Dubai boundary and
    // flips the seeded contractor's PENDING free-zone item to EXPIRED in place.
    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));
    expect(store.items.find(r => r.id === item.id)?.status).toBe('EXPIRED');

    // Step 2 (F1+F3): the EXPIRED BLOCKING item now arms the enforced hard-block.
    try {
      await assertContractorPaymentEligibility([SEEDED.contractorId], {
        organizationId: SEEDED.organizationId,
      });
      throw new Error('expected PRECONDITION_FAILED');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
      const cause = (err as TRPCError).cause as {
        contractorReasons: Array<{
          contractorId: string;
          reasons: Array<{ policyRuleId: string | null }>;
        }>;
      };
      // Tenant isolation is load-bearing: only the seeded contractor's reason
      // survives; the OTHER_ORG/OTHER_CONTRACTOR row is filtered out (WR-02).
      expect(cause.contractorReasons).toHaveLength(1);
      expect(cause.contractorReasons[0]?.contractorId).toBe(SEEDED.contractorId);
      expect(cause.contractorReasons[0]?.reasons[0]?.policyRuleId).toBe('uae.free_zone_license@v2');
    }
    // The enforced branch throws and writes NO audit row (compliance-payment-gate.ts:114-120).
    expect(auditWriteSpy).not.toHaveBeenCalled();

    // Step 3 (F3): the Saudization advisory derives its headcount from the SAME
    // seeded context — advisory-only, non-gating, never asserts a band.
    const traj = projectOffboardingTrajectory({
      headcount: SEEDED.headcount,
      currentBand: 'MID_GREEN',
      offboardingContractorIsSaudi: true,
    });
    expect(traj.advisory).toBe(true);
    expect(traj.authoritative).toBe(false);
    expect(traj.projectedRate).not.toBeNull();
    expect(traj.currentRate).not.toBeNull();
    expect(traj.projectedRate as number).toBeLessThan(traj.currentRate as number);
    // The locked anti-feature: the advisory result is EXACTLY this key set — adding
    // any new key (e.g. an accidental `projectedBand`) trips this assertion.
    expect(Object.keys(traj).sort()).toEqual(TRAJECTORY_KEYS);

    // Step 4 (F4): an open IP_VERIFICATION task on the SAME seeded run hard-blocks
    // offboarding completion. The gate mock scopes the open task to the seeded
    // org, so the taskType / workflowRunId / organizationId filters are all
    // load-bearing for this leg.
    const gateClient = makeGateClient({
      openIpTaskIds: ['task_ip_seeded'],
      workflowRunId: SEEDED.workflowRunId,
      organizationId: SEEDED.organizationId,
    });
    try {
      await assertRunCompletable(gateClient, SEEDED.workflowRunId, SEEDED.organizationId);
      throw new Error('expected PRECONDITION_FAILED');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
      const cause = (err as TRPCError).cause as { blockedTaskKind: string; openTaskIds: string[] };
      expect(cause.blockedTaskKind).toBe('IP_VERIFICATION');
      expect(cause.openTaskIds).toContain('task_ip_seeded');
    }

    // F4 tenant isolation: the SAME open task queried under a DIFFERENT org is
    // out of scope, so a cross-org completion check does NOT block.
    await expect(
      assertRunCompletable(gateClient, SEEDED.workflowRunId, OTHER_ORG_ID),
    ).resolves.toBeUndefined();
  });

  it('captures the compliance.payment.would_block audit row via the honest flag-OFF would-block branch, pinned to exactly CONTRACTOR_ID', async () => {
    // Reuse the SAME EXPIRED store state the composed flow produces, plus a
    // SECOND-tenant EXPIRED row so the would-block contractorReasons pin is a real
    // isolation control (the OTHER row must not leak into the audit metadata).
    const item = recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));
    recordFreeZoneItemFor({
      id: 'clmefzitemeeeeeeeeeeeeeeeee',
      organizationId: OTHER_ORG_ID,
      contractorId: OTHER_CONTRACTOR_ID,
      expiresAt: new Date('2026-03-01T00:00:00Z'),
      status: 'EXPIRED',
    });
    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));
    expect(store.items.find(r => r.id === item.id)?.status).toBe('EXPIRED');
    auditWriteSpy.mockClear();

    // The enforced path writes no row, so the documented audit-emitting path is the
    // flag-OFF would-block branch (compliance-payment-gate.ts:106-120). This is the
    // honest enforced-vs-audit split: never assert hard-block AND audit on one call.
    const result = await assertContractorPaymentEligibility([SEEDED.contractorId], {
      organizationId: SEEDED.organizationId,
      flagEnabled: false,
    });
    expect(result.wouldBlock).toBe(true);
    expect(result.blocked).toBe(false);

    expect(auditWriteSpy).toHaveBeenCalledTimes(1);
    const auditArg = auditWriteSpy.mock.calls[0]?.[0] as {
      action: string;
      organizationId: string;
      metadata: { contractorReasons: Array<{ contractorId: string }> };
    };
    expect(auditArg.action).toBe('compliance.payment.would_block');
    expect(auditArg.organizationId).toBe(SEEDED.organizationId);
    expect(auditArg.metadata.contractorReasons).toHaveLength(1);
    expect(auditArg.metadata.contractorReasons[0]?.contractorId).toBe(SEEDED.contractorId);
  });
});

describe('SC#1 mocks — the gate mocks honour their where predicates (WR-02 + WR-03)', () => {
  it('excludes a second-contractor EXPIRED BLOCKING row when only CONTRACTOR_ID is queried (where.contractorId.in)', async () => {
    recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));
    store.items[0].status = 'EXPIRED';
    recordFreeZoneItemFor({
      id: 'clmefzitembbbbbbbbbbbbbbbbb',
      organizationId: ME_ORG.id,
      contractorId: OTHER_CONTRACTOR_ID,
      expiresAt: new Date('2026-03-01T00:00:00Z'),
      status: 'EXPIRED',
    });

    const result = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
      organizationId: ME_ORG.id,
      throwOnFail: false,
    });
    expect(result.contractorReasons).toHaveLength(1);
    expect(result.contractorReasons[0]?.contractorId).toBe(CONTRACTOR_ID);
  });

  it('excludes a second-org EXPIRED BLOCKING row for the same contractor when ME_ORG is queried (where.contractor.is.organizationId)', async () => {
    recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));
    store.items[0].status = 'EXPIRED';
    recordFreeZoneItemFor({
      id: 'clmefzitemccccccccccccccccc',
      organizationId: OTHER_ORG_ID,
      contractorId: CONTRACTOR_ID,
      expiresAt: new Date('2026-03-01T00:00:00Z'),
      status: 'EXPIRED',
    });

    const result = await assertContractorPaymentEligibility([CONTRACTOR_ID, OTHER_CONTRACTOR_ID], {
      organizationId: ME_ORG.id,
      throwOnFail: false,
    });
    // Only the ME_ORG row survives the contractor.is.organizationId guard.
    expect(result.contractorReasons).toHaveLength(1);
    expect(result.contractorReasons[0]?.contractorId).toBe(CONTRACTOR_ID);
    expect(result.contractorReasons[0]?.reasons[0]?.itemId).toBe('clmefzitemaaaaaaaaaaaaaaaaa');
  });

  it('returns the open IP task only when ALL FOUR predicates match — taskType, workflowRunId, organizationId, and an open status (makeGateClient.workflowTaskRun.findMany)', async () => {
    const client = makeGateClient({
      openIpTaskIds: ['task_ip'],
      workflowRunId: 'run_1',
      organizationId: ME_ORG.id,
    });
    type TaskRunFindMany = (a: {
      where?: {
        taskType?: string;
        workflowRunId?: string;
        organizationId?: string;
        status?: { in?: string[] };
      };
    }) => Promise<Array<{ id: string }>>;
    const findMany = (client as unknown as { workflowTaskRun: { findMany: TaskRunFindMany } })
      .workflowTaskRun.findMany;
    // The real gate's open-status set — closed statuses (DONE/CANCELLED) are excluded.
    const openStatus = { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] };

    // All four predicates match → the row is returned.
    const matched = await findMany({
      where: {
        taskType: 'IP_VERIFICATION',
        workflowRunId: 'run_1',
        organizationId: ME_ORG.id,
        status: openStatus,
      },
    });
    expect(matched).toEqual([{ id: 'task_ip' }]);

    // A non-IP task type is filtered out.
    const nonIp = await findMany({
      where: {
        taskType: 'KNOWLEDGE_TRANSFER',
        workflowRunId: 'run_1',
        organizationId: ME_ORG.id,
        status: openStatus,
      },
    });
    expect(nonIp).toEqual([]);

    // A mismatched runId is filtered out.
    const wrongRun = await findMany({
      where: {
        taskType: 'IP_VERIFICATION',
        workflowRunId: 'run_other',
        organizationId: ME_ORG.id,
        status: openStatus,
      },
    });
    expect(wrongRun).toEqual([]);

    // A cross-org query is filtered out (organizationId predicate is load-bearing).
    const wrongOrg = await findMany({
      where: {
        taskType: 'IP_VERIFICATION',
        workflowRunId: 'run_1',
        organizationId: OTHER_ORG_ID,
        status: openStatus,
      },
    });
    expect(wrongOrg).toEqual([]);

    // A closed-status query (the seeded task is TODO, which is NOT in this set) is
    // filtered out (the open-status predicate is load-bearing).
    const closedStatus = await findMany({
      where: {
        taskType: 'IP_VERIFICATION',
        workflowRunId: 'run_1',
        organizationId: ME_ORG.id,
        status: { in: ['DONE', 'CANCELLED'] },
      },
    });
    expect(closedStatus).toEqual([]);
  });
});

describe('SC#1 F1+F3 — free-zone payment hard-block composes with the F3 advisory', () => {
  it('does NOT block payment while the recorded free-zone license is still valid (PENDING)', async () => {
    recordValidFreeZoneItem(new Date('2027-01-01T00:00:00Z'));

    const result = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
      organizationId: ME_ORG.id,
    });
    expect(result).toEqual({ blocked: false, wouldBlock: false, contractorReasons: [] });
  });

  it('flips the PENDING free-zone item to EXPIRED during the regional reminder scan once the Asia/Dubai boundary is crossed', async () => {
    const item = recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));
    expect(item.status).toBe('PENDING');

    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));

    const after = store.items.find(r => r.id === item.id);
    expect(after?.status).toBe('EXPIRED');
  });

  it('arms the BLOCKING payment hard-block after the scan flips the item to EXPIRED (record → cross-boundary → block), surfacing the free-zone doc in cause.contractorReasons', async () => {
    const item = recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));

    // Before the boundary scan, the gate does NOT block (item is still PENDING).
    const before = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
      organizationId: ME_ORG.id,
    });
    expect(before.blocked).toBe(false);

    // The cron scan crosses the boundary and persists PENDING → EXPIRED.
    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));

    // Now the BLOCKING + EXPIRED item arms the hard-block (F1+F3 compose).
    try {
      await assertContractorPaymentEligibility([CONTRACTOR_ID], { organizationId: ME_ORG.id });
      throw new Error('expected PRECONDITION_FAILED');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
      const cause = (err as TRPCError).cause as {
        contractorReasons: Array<{
          contractorId: string;
          reasons: Array<{ policyRuleId: string | null; deepLinkPath: string }>;
        }>;
      };
      expect(cause.contractorReasons).toHaveLength(1);
      const reason = cause.contractorReasons[0]?.reasons[0];
      expect(reason?.policyRuleId).toBe('uae.free_zone_license@v2');
      expect(reason?.deepLinkPath).toBe(`/contractors/${CONTRACTOR_ID}/compliance#item-${item.id}`);
    }

    const after = store.items.find(r => r.id === item.id);
    expect(after?.status).toBe('EXPIRED');
  });
});

describe('SC#1 F3 — Saudization offboarding band-trajectory is advisory-only and non-gating', () => {
  it('recomputes a projected RATE below the current rate when a Saudi national is offboarded, asserts advisory:true / authoritative:false, and NEVER returns a projectedBand', () => {
    const traj = projectOffboardingTrajectory({
      headcount: { totalHeadcount: 100, saudiHeadcount: 50 },
      currentBand: 'MID_GREEN',
      offboardingContractorIsSaudi: true,
    });

    expect(traj.advisory).toBe(true);
    expect(traj.authoritative).toBe(false);
    expect(traj.currentBand).toBe('MID_GREEN');
    expect(traj.currentRate).toBeCloseTo(0.5, 5);
    expect(traj.projectedRate).toBeCloseTo(49 / 99, 5);
    expect(traj.projectedRate).not.toBeNull();
    expect(traj.currentRate).not.toBeNull();
    expect(traj.projectedRate as number).toBeLessThan(traj.currentRate as number);
    // The locked anti-feature: the result is EXACTLY this key set, so an advisory
    // render can never grow a projected band (or any other) field.
    expect(Object.keys(traj).sort()).toEqual(TRAJECTORY_KEYS);
  });

  it('is a pure, non-gating function (single params arg, no DB client, never throws)', () => {
    expect(projectOffboardingTrajectory.length).toBe(1);
    const traj = projectOffboardingTrajectory({
      headcount: null,
      currentBand: null,
      offboardingContractorIsSaudi: true,
    });
    expect(traj.advisory).toBe(true);
    expect(traj.authoritative).toBe(false);
    // Even on the null-headcount path the shape is the locked key set — no band.
    expect(Object.keys(traj).sort()).toEqual(TRAJECTORY_KEYS);
  });
});

// In-memory gate client mirroring the structural RunGateClient shape
// (workflow-execution-ip-block.test.ts). assertRunCompletable reads only these
// three relations and — crucially for the composed audit assertion below — never
// calls writeAuditLog itself.
function makeGateClient(opts: {
  overrideMetadata?: unknown;
  openIpTaskIds?: string[];
  workflowRunId?: string;
  organizationId?: string;
  /** Status the seeded open task carries; defaults to an OPEN status (TODO). */
  taskStatus?: string;
  pendingCreds?: Array<{ id: string; label: string; vaultProvider: string }>;
}) {
  return {
    workflowTaskRun: {
      // Honour ALL FOUR of assertRunCompletable's where predicates so each is
      // load-bearing: taskType, workflowRunId, organizationId, and the open-status
      // set. A wrong-org query, a mismatched run, a non-IP task, or a closed-status
      // task must each return [] — exactly as the real query would scope them.
      findMany: async (args: {
        where?: {
          taskType?: string;
          workflowRunId?: string;
          organizationId?: string;
          status?: { in?: string[] };
        };
      }) => {
        if (args.where?.taskType !== 'IP_VERIFICATION') return [];
        if (opts.workflowRunId && args.where?.workflowRunId !== opts.workflowRunId) return [];
        if (opts.organizationId && args.where?.organizationId !== opts.organizationId) return [];
        const wantStatus = args.where?.status?.in;
        if (wantStatus && !wantStatus.includes(opts.taskStatus ?? 'TODO')) return [];
        return (opts.openIpTaskIds ?? []).map(id => ({ id }));
      },
    },
    workflowRun: {
      findUniqueOrThrow: async () => ({ overrideMetadata: opts.overrideMetadata ?? null }),
    },
    credentialReference: {
      findMany: async () => opts.pendingCreds ?? [],
    },
  } as never;
}

describe('SC#1 F4 — offboarding IP_VERIFICATION hard-block (writes no audit row of its own)', () => {
  it('hard-blocks offboarding while an IP_VERIFICATION task is open, with cause.blockedTaskKind === IP_VERIFICATION', async () => {
    const client = makeGateClient({ openIpTaskIds: ['task_ip'] });
    try {
      await assertRunCompletable(client, 'run_1', ME_ORG.id);
      throw new Error('expected PRECONDITION_FAILED');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
      const cause = (err as TRPCError).cause as {
        blockedTaskKind: string;
        openTaskIds: string[];
      };
      expect(cause.blockedTaskKind).toBe('IP_VERIFICATION');
      expect(cause.openTaskIds).toEqual(['task_ip']);
    }
    // The F4 hard-block path emits NO audit row — it merely throws. The only
    // audit rows in this composed SC#1 hard-block scenario are the F1/F3 rows
    // asserted in the audit describe below.
    expect(auditWriteSpy).not.toHaveBeenCalled();
  });

  it('a Phase-74 override (overrideMetadata.blockedTaskKind=IP_VERIFICATION) clears the block — the gate is overridable, not absent', async () => {
    const client = makeGateClient({
      openIpTaskIds: ['task_ip'],
      overrideMetadata: { blockedTaskKind: 'IP_VERIFICATION' },
    });
    await expect(assertRunCompletable(client, 'run_1', ME_ORG.id)).resolves.toBeUndefined();
  });
});

describe('SC#1 audit — the F1/F3 gate path emits an AuditLog row (the F4 hard-block emits none)', () => {
  it('records the compliance.payment.would_block AuditLog row via the F1/F3 gate path (flag-OFF would-block branch) once the free-zone item is EXPIRED', async () => {
    const item = recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));

    // The cron scan crosses the Asia/Dubai boundary and persists PENDING → EXPIRED.
    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));
    expect(store.items.find(r => r.id === item.id)?.status).toBe('EXPIRED');
    auditWriteSpy.mockClear();

    // Drive the gate's would-block branch (flag OFF) — this is the F1/F3 gate path
    // that writes an AuditLog row. With the flag ON the gate throws and writes
    // nothing, so the would-block branch is the deterministic audit-emitting path.
    const result = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
      organizationId: ME_ORG.id,
      flagEnabled: false,
    });
    expect(result.wouldBlock).toBe(true);
    expect(result.blocked).toBe(false);

    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance.payment.would_block',
        organizationId: ME_ORG.id,
        metadata: expect.objectContaining({
          contractorReasons: expect.arrayContaining([
            expect.objectContaining({ contractorId: CONTRACTOR_ID }),
          ]),
        }),
      }),
    );
  });

  it('the composed F4 hard-block path adds no audit row — assertRunCompletable never calls the audit writer', async () => {
    auditWriteSpy.mockClear();
    const client = makeGateClient({ openIpTaskIds: ['task_ip'] });
    await expect(assertRunCompletable(client, 'run_1', ME_ORG.id)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    expect(auditWriteSpy).not.toHaveBeenCalled();
  });
});

describe('SC#1 locked-phrase guard — Gulf AE/SA legal phrases are green (no drift)', () => {
  it('RESERVED_AE_LEGAL_KEYS mirrors LOCKED_AE_PHRASES keys and every value is a non-empty string', () => {
    expect([...RESERVED_AE_LEGAL_KEYS].sort()).toEqual(Object.keys(LOCKED_AE_PHRASES).sort());
    for (const [key, value] of Object.entries(LOCKED_AE_PHRASES)) {
      expect(typeof value, `${key} is not a string`).toBe('string');
      expect((value as string).length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it('RESERVED_SA_LEGAL_KEYS mirrors LOCKED_SA_PHRASES keys and the NITAQAT_BAND_* literals equal their UPPER_SNAKE enum strings', () => {
    expect([...RESERVED_SA_LEGAL_KEYS].sort()).toEqual(Object.keys(LOCKED_SA_PHRASES).sort());
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_PLATINUM).toBe('PLATINUM');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_HIGH_GREEN).toBe('HIGH_GREEN');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_MID_GREEN).toBe('MID_GREEN');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_LOW_GREEN).toBe('LOW_GREEN');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_YELLOW).toBe('YELLOW');
    expect(LOCKED_SA_PHRASES.NITAQAT_BAND_RED).toBe('RED');
  });
});
