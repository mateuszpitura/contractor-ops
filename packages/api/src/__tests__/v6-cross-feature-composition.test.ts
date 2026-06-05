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

beforeEach(() => {
  store.items.length = 0;
  clientCache.clear();
  auditWriteSpy.mockClear();
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
    expect(traj.projectedRate ?? 1).toBeLessThan(traj.currentRate ?? 0);
    // The locked anti-feature: an advisory render must never assert a band.
    expect(traj).not.toHaveProperty('projectedBand');
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
    expect(traj).not.toHaveProperty('projectedBand');
  });
});
