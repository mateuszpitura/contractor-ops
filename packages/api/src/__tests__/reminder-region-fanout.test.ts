// Phase 79 Wave 2 — GREEN (was Wave 0 RED scaffold).
//
// Critical behavior C3 (GULF-02, Pitfall 18): the compliance reminder scan
// iterates SUPPORTED_REGIONS ('EU','ME') so an ME-region BLOCKING free-zone item
// enters the 90/60/30/15/7 cascade.
//
// LANDMINE: runComplianceReminderScan previously closed over the module-level
// prismaRaw client (= DATABASE_URL = EU only) and the reminders cron handler
// called it once with no region iteration — so UAE/KSA orgs (which live in the ME
// DB) never received reminders. The scan now accepts a Prisma client and is fanned
// across getRegionalClient(region) per SUPPORTED_REGIONS.
//
// Template: apps/cron-worker/src/jobs/handlers/exchange-rates.ts (fans across
// SUPPORTED_REGIONS) + packages/db/src/region.ts getRegionalClient.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFreeZoneComplianceItem } from './__fixtures__/gulf-fixtures';

const {
  mockGetRegionalClient,
  mockClaimDedup,
  mockDispatch,
  mockResolveRecipients,
  itemsByRegion,
  claimedKeys,
} = vi.hoisted(() => {
  const itemsByRegion = new Map<string, Array<Record<string, unknown>>>();
  const claimedKeys = new Set<string>();

  // A per-region in-memory client. Each region scans only its own items so we can
  // prove an ME-region free-zone item is reached only via the ME client.
  function regionClientFactory(region: string) {
    return {
      contractorComplianceItem: {
        findMany: vi.fn(async () => itemsByRegion.get(region) ?? []),
        // Phase 79 CR-01 — the scan flips free-zone PENDING items to EXPIRED at the
        // TZ boundary via this update; these fixtures are not yet expired so it no-ops.
        update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
          const list = itemsByRegion.get(region) ?? [];
          const row = list.find(r => r.id === a.where.id);
          if (row) Object.assign(row, a.data);
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

  return {
    itemsByRegion,
    claimedKeys,
    regionClientFactory,
    // Throws for a region whose env is "unset" (we mark that by storing `null`).
    mockGetRegionalClient: vi.fn((region: string) => {
      if (itemsByRegion.get(region) === null) {
        throw new Error(
          `DATABASE_URL_${region} environment variable is not set for region ${region}`,
        );
      }
      let c = clientCache.get(region);
      if (!c) {
        c = regionClientFactory(region);
        clientCache.set(region, c);
      }
      return c;
    }),
    mockClaimDedup: vi.fn(async (key: string) => {
      if (claimedKeys.has(key)) return false;
      claimedKeys.add(key);
      return true;
    }),
    mockDispatch: vi.fn(async () => undefined),
    mockResolveRecipients: vi.fn(async () => ['user-admin-1']),
  };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: {},
  prismaRaw: {},
  SUPPORTED_REGIONS: ['EU', 'ME'] as const,
  getRegionalClient: mockGetRegionalClient,
}));
vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(),
 warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));
vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn(), distribution: vi.fn() },
}));
vi.mock('../services/notification-service', () => ({ dispatch: mockDispatch }));
vi.mock('../services/rbac-recipients', () => ({ resolveRbacRecipients: mockResolveRecipients }));
vi.mock('../services/cron-dedup', () => ({ claimCronNotificationDedup: mockClaimDedup }));
vi.mock('../services/compliance-payment-gate', () => ({
  getDocumentTypeLabelKey: vi.fn((_d: string, p: string | null) =>
    p ? `Compliance.documentType.compliance-policy-engine.${p.replace(/@v\d+$/, '')}` : 'unknown',
  ),
}));
vi.mock('../i18n/email-i18n', () => ({
  normalizeLocale: vi.fn(() => 'en'),
  resolveMessage: vi.fn((key: string) => key),
}));

import { runComplianceReminderScan } from '../services/compliance-reminder-scan';

const ORG_ME = 'clmeorgaaaaaaaaaaaaaaaaaaaa';

/** An ME-region BLOCKING free-zone item ~30 days from expiry (enters the cascade). */
function meFreeZoneItem(now: Date) {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  const item = makeFreeZoneComplianceItem({ organizationId: ORG_ME, expiresAt, status: 'PENDING' });
  return {
    id: item.id,
    organizationId: ORG_ME,
    contractorId: item.contractorId,
    documentType: item.documentType,
    policyRuleId: item.policyRuleId,
    status: 'PENDING',
    expiresAt,
    expiryJurisdictionTz: item.expiryJurisdictionTz,
    contractor: { displayName: 'Gulf Free-Zone Contractor' },
  };
}

beforeEach(() => {
  itemsByRegion.clear();
  claimedKeys.clear();
  mockGetRegionalClient.mockClear();
  mockClaimDedup.mockClear();
  mockDispatch.mockClear();
  mockResolveRecipients.mockClear();
  mockResolveRecipients.mockResolvedValue(['user-admin-1']);
});

describe('C3 (Pitfall 18) reminder region fan-out — ME free-zone items enter the cascade', () => {
  it('runs the compliance reminder scan once per SUPPORTED_REGIONS region [79-03]', async () => {
    itemsByRegion.set('EU', []);
    itemsByRegion.set('ME', []);

    await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z'));

    const regionsResolved = mockGetRegionalClient.mock.calls.map(c => c[0]);
    expect(regionsResolved).toEqual(['EU', 'ME']);
  });

  it('uses getRegionalClient(region) so an ME-region BLOCKING free-zone item is scanned [79-03]', async () => {
    const now = new Date('2026-06-03T09:00:00Z');
    itemsByRegion.set('EU', []);
    itemsByRegion.set('ME', [meFreeZoneItem(now)]);

    const result = await runComplianceReminderScan(now);

    // The ME free-zone item was scanned + fired exactly once via the ME client.
    expect(mockGetRegionalClient).toHaveBeenCalledWith('ME');
    expect(result.scanned).toBe(1);
    expect(result.fires).toBe(1);
    expect(result.digests).toBe(1);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('skips a region gracefully when its DATABASE_URL_* env var is not configured [79-03]', async () => {
    const now = new Date('2026-06-03T09:00:00Z');
    itemsByRegion.set('EU', []);
    itemsByRegion.set('ME', null as unknown as Array<Record<string, unknown>>); // env unset → getRegionalClient throws

    // EU still scans; ME is skipped without throwing.
    const result = await runComplianceReminderScan(now);
    expect(result).toEqual({ scanned: 0, fires: 0, digests: 0 });
    // getRegionalClient was still attempted for both regions.
    expect(mockGetRegionalClient.mock.calls.map(c => c[0])).toEqual(['EU', 'ME']);
  });

  it('does not collide cron dedup keys across regions [79-03]', async () => {
    const now = new Date('2026-06-03T09:00:00Z');
    // Same item id present in BOTH regions (pathological, but proves key isolation).
    const euItem = { ...meFreeZoneItem(now), organizationId: 'cleuorgaaaaaaaaaaaaaaaaaaaa' };
    itemsByRegion.set('EU', [euItem]);
    itemsByRegion.set('ME', [meFreeZoneItem(now)]);

    const result = await runComplianceReminderScan(now);

    // Both regions fired — neither suppressed the other via a shared dedup key.
    expect(result.fires).toBe(2);
    const bandKeys = [...claimedKeys].filter(k => k.startsWith('compl:band:'));
    expect(bandKeys.some(k => k.startsWith('compl:band:EU:'))).toBe(true);
    expect(bandKeys.some(k => k.startsWith('compl:band:ME:'))).toBe(true);
    const digestKeys = [...claimedKeys].filter(k => k.startsWith('compl:digest:'));
    expect(digestKeys.some(k => k.startsWith('compl:digest:EU:'))).toBe(true);
    expect(digestKeys.some(k => k.startsWith('compl:digest:ME:'))).toBe(true);
  });
});
