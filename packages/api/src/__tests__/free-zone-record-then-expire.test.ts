// Regression: the payment hard-block must arm for a free-zone license that
// EXPIRES AFTER it was recorded, not only one written already-expired. The
// realistic admin flow is: record a free-zone assignment while the license is
// still valid (status PENDING, no block), then the license crosses its
// Asia/Dubai expiry boundary. The region-aware reminder scan is the only
// background pass that runs in the cron's tenant-frame-less context, so it
// must flip free-zone PENDING items to EXPIRED at the boundary (via
// reEvaluateFreeZoneStatus) — otherwise the row stays PENDING forever and the
// BLOCKING payment gate (which keys on status='EXPIRED') never engages.
//
// This end-to-end test wires the REAL runComplianceReminderScan + the REAL
// assertContractorPaymentEligibility against one shared mutable item store, so it
// proves the full record → cross-boundary → scan → gate-blocks path.

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
          const statusFilter = where.status as string | { in?: string[] } | undefined;
          if (typeof statusFilter === 'string' && r.status !== statusFilter) return false;
          if (statusFilter && typeof statusFilter === 'object' && 'in' in statusFilter) {
            if (!statusFilter.in?.includes(r.status as string)) return false;
          }
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
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
vi.mock('../services/audit-writer', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../i18n/email-i18n', () => ({
  normalizeLocale: vi.fn(() => 'en'),
  resolveMessage: vi.fn((key: string) => key),
}));

import { assertContractorPaymentEligibility } from '../services/compliance-payment-gate';
import { runComplianceReminderScan } from '../services/compliance-reminder-scan';

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
});

describe('CR-01 free-zone record-then-expire — reminder scan arms the payment gate', () => {
  it('does NOT block payment while the recorded free-zone license is still valid (PENDING) [79-gap]', async () => {
    // Recorded while valid: expires well in the future.
    recordValidFreeZoneItem(new Date('2027-01-01T00:00:00Z'));

    const result = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
      organizationId: ME_ORG.id,
    });
    expect(result).toEqual({ blocked: false, wouldBlock: false, contractorReasons: [] });
  });

  it('flips the PENDING free-zone item to EXPIRED during the regional reminder scan once the TZ boundary is crossed [79-gap]', async () => {
    const item = recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));
    // Sanity: recorded valid, not yet expired.
    expect(item.status).toBe('PENDING');

    // Cron tick AFTER the Asia/Dubai expiry boundary.
    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));

    const after = store.items.find(r => r.id === item.id);
    expect(after?.status).toBe('EXPIRED');
  });

  it('arms the BLOCKING payment gate after the scan flips the item to EXPIRED (record → cross-boundary → block) [79-gap]', async () => {
    const item = recordValidFreeZoneItem(new Date('2026-03-01T00:00:00Z'));

    // Before the boundary scan, the gate does NOT block (item is still PENDING).
    const before = await assertContractorPaymentEligibility([CONTRACTOR_ID], {
      organizationId: ME_ORG.id,
    });
    expect(before.blocked).toBe(false);

    // The cron scan crosses the boundary and persists PENDING → EXPIRED.
    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));

    // Now the BLOCKING + EXPIRED item arms the hard-block.
    await expect(
      assertContractorPaymentEligibility([CONTRACTOR_ID], { organizationId: ME_ORG.id }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    const after = store.items.find(r => r.id === item.id);
    expect(after?.status).toBe('EXPIRED');
  });
});
