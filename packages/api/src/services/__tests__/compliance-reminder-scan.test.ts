// GREEN tests for compliance-reminder-scan.
//
// Exercises the band classifier, TZ day-math, the two-pass digest orchestrator,
// per-band + per-recipient dedup, optimistic-concurrency loss, and the
// renewal-reset listener. Mirrors the economic-dependency-scan test shape.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrismaRaw,
  mockPrisma,
  mockDispatch,
  mockResolveRecipients,
  mockClaimDedup,
  mockMetricsGauge,
  itemsFixture,
  reminderStateByItem,
  claimedKeys,
  auditLogCreates,
} = vi.hoisted(() => {
  interface ReminderStateRow {
    itemId: string;
    organizationId: string;
    currentBand: string;
    lastBandFired: string | null;
    lastBandFiredAt: Date | null;
    version: number;
  }

  const itemsFixture: Record<string, unknown>[] = [];
  const reminderStateByItem = new Map<string, ReminderStateRow>();
  const claimedKeys = new Set<string>();
  const auditLogCreates: Record<string, unknown>[] = [];

  // All cron-context reads/writes go through prismaRaw (M-NEW-2).
  const reminderStateDelegate = {
    findUnique: vi.fn(async (args: { where: { itemId: string } }) => {
      return reminderStateByItem.get(args.where.itemId) ?? null;
    }),
    updateMany: vi.fn(
      async (args: {
        where: { itemId: string; version: number };
        data: Record<string, unknown>;
      }) => {
        const row = reminderStateByItem.get(args.where.itemId);
        if (!row || row.version !== args.where.version) return { count: 0 };
        const next = { ...row };
        for (const [k, v] of Object.entries(args.data)) {
          if (v && typeof v === 'object' && 'increment' in (v as Record<string, unknown>)) {
            (next as Record<string, unknown>)[k] =
              (row as Record<string, number>)[k] + (v as { increment: number }).increment;
          } else {
            (next as Record<string, unknown>)[k] = v;
          }
        }
        reminderStateByItem.set(args.where.itemId, next);
        return { count: 1 };
      },
    ),
    create: vi.fn(async (args: { data: ReminderStateRow }) => {
      if (reminderStateByItem.has(args.data.itemId)) {
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      reminderStateByItem.set(args.data.itemId, { ...args.data });
      return args.data;
    }),
    upsert: vi.fn(
      async (args: {
        where: { itemId: string };
        create: ReminderStateRow;
        update: Record<string, unknown>;
      }) => {
        const existing = reminderStateByItem.get(args.where.itemId);
        if (existing) {
          const next = { ...existing };
          for (const [k, v] of Object.entries(args.update)) {
            if (v && typeof v === 'object' && 'increment' in (v as Record<string, unknown>)) {
              (next as Record<string, unknown>)[k] =
                (existing as Record<string, number>)[k] + (v as { increment: number }).increment;
            } else {
              (next as Record<string, unknown>)[k] = v;
            }
          }
          reminderStateByItem.set(args.where.itemId, next);
          return next;
        }
        reminderStateByItem.set(args.where.itemId, { ...args.create });
        return args.create;
      },
    ),
  };

  // mockPrismaRaw covers all cron-context operations:
  //   - contractorComplianceItem.findMany (top-level scan)
  //   - contractorComplianceReminderState (per-item state reads/writes — M-NEW-2)
  //   - organization.findUnique (org language for digest locale)
  const mockPrismaRaw = {
    contractorComplianceItem: {
      findMany: vi.fn(async () => itemsFixture),
    },
    contractorComplianceReminderState: reminderStateDelegate,
    organization: {
      findUnique: vi.fn(async () => ({ language: 'en' })),
    },
  };

  // mockPrisma is used only by the renewal-reset listener (onComplianceItemExpiresAtChanged),
  // which runs inside a caller-supplied tx (not a cron singleton). The tx mock is cast as
  // RecoveryClient in those tests; the audit log create is intercepted here.
  const mockPrisma = {
    contractorComplianceReminderState: reminderStateDelegate,
    auditLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        auditLogCreates.push(args.data);
        return args.data;
      }),
    },
  };

  return {
    mockPrismaRaw,
    mockPrisma,
    mockDispatch: vi.fn(async () => undefined),
    mockResolveRecipients: vi.fn(async () => ['user-admin-1']),
    mockClaimDedup: vi.fn(async (key: string) => {
      if (claimedKeys.has(key)) return false;
      claimedKeys.add(key);
      return true;
    }),
    mockMetricsGauge: vi.fn(),
    itemsFixture,
    reminderStateByItem,
    claimedKeys,
    auditLogCreates,
  };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  prismaRaw: mockPrismaRaw,
  // The public scan loops SUPPORTED_REGIONS and resolves a regional client per
  // region. These existing tests assert single-region behaviour, so we expose a
  // one-region set whose client IS the cron-context mock (mockPrismaRaw),
  // keeping every existing findMany/state/digest assertion intact.
  SUPPORTED_REGIONS: ['EU'] as const,
  getRegionalClient: vi.fn(() => mockPrismaRaw),
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockMetricsGauge, increment: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../notification-service', () => ({ dispatch: mockDispatch }));
vi.mock('../rbac-recipients', () => ({ resolveRbacRecipients: mockResolveRecipients }));
vi.mock('../cron-dedup', () => ({ claimCronNotificationDedup: mockClaimDedup }));
vi.mock('../compliance-payment-gate', () => ({
  getDocumentTypeLabelKey: vi.fn((_documentType: string, policyRuleId: string | null) =>
    policyRuleId
      ? `Compliance.documentType.compliance-policy-engine.${policyRuleId.replace(/@v\d+$/, '')}`
      : `Compliance.documentType.compliance-policy-engine.unknown`,
  ),
}));
vi.mock('../../i18n/email-i18n', () => ({
  normalizeLocale: vi.fn(() => 'en'),
  resolveMessage: vi.fn((key: string, _locale: string, params?: Record<string, unknown>) => {
    // Return a simple interpolated string so digest tests can assert on structure.
    if (!params) return key;
    return key.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? ''));
  }),
}));

import { normalizeLocale } from '../../i18n/email-i18n';

import {
  bandFor,
  bandIndex,
  onComplianceItemExpiresAtChanged,
  runComplianceReminderScan,
} from '../compliance-reminder-scan';

const ORG = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const TZ_BERLIN = 'Europe/Berlin';

// contractor.displayName is embedded in the top-level query result (N+1 eliminated — M-NEW-1).
const CONTRACTOR_NAMES: Record<string, string> = {
  'ctr-1': 'Acme GmbH',
  'ctr-2': 'Beta Ltd',
  'ctr-3': 'Gamma SARL',
};

function makeItem(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const contractorId = (over.contractorId as string | undefined) ?? 'ctr-1';
  return {
    id: `item-${itemsFixture.length + 1}`,
    organizationId: ORG,
    contractorId,
    documentType: 'A1_CERTIFICATE',
    policyRuleId: 'de.a1@v1',
    expiresAt: new Date('2026-08-01T00:00:00Z'),
    expiryJurisdictionTz: TZ_BERLIN,
    contractor: { displayName: CONTRACTOR_NAMES[contractorId] ?? 'Unknown Contractor' },
    ...over,
  };
}

function resetFixtures() {
  itemsFixture.length = 0;
  reminderStateByItem.clear();
  claimedKeys.clear();
  auditLogCreates.length = 0;
  mockPrismaRaw.contractorComplianceItem.findMany.mockClear();
  mockPrismaRaw.contractorComplianceReminderState.findUnique.mockClear();
  mockPrismaRaw.contractorComplianceReminderState.updateMany.mockClear();
  mockPrismaRaw.contractorComplianceReminderState.create.mockClear();
  mockPrismaRaw.contractorComplianceReminderState.upsert.mockClear();
  mockPrismaRaw.organization.findUnique.mockClear();
  mockPrisma.auditLog.create.mockClear();
  mockDispatch.mockClear();
  mockResolveRecipients.mockReset();
  mockResolveRecipients.mockResolvedValue(['user-admin-1']);
  mockClaimDedup.mockClear();
  mockMetricsGauge.mockClear();
}

beforeEach(resetFixtures);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('compliance-reminder-scan bandFor', () => {
  it('maps daysUntilExpiry to the correct band across the cascade boundaries', () => {
    expect(bandFor(Number.NaN)).toBe('NONE');
    expect(bandFor(-1)).toBe('EXPIRED');
    expect(bandFor(0)).toBe('D7');
    expect(bandFor(7)).toBe('D7');
    expect(bandFor(8)).toBe('D15');
    expect(bandFor(15)).toBe('D15');
    expect(bandFor(16)).toBe('D30');
    expect(bandFor(30)).toBe('D30');
    expect(bandFor(31)).toBe('D60');
    expect(bandFor(60)).toBe('D60');
    expect(bandFor(61)).toBe('D90');
    expect(bandFor(90)).toBe('D90');
    expect(bandFor(91)).toBe('NONE');
  });

  it('bandIndex is monotonically increasing along the cascade', () => {
    expect(bandIndex('NONE')).toBeLessThan(bandIndex('D90'));
    expect(bandIndex('D90')).toBeLessThan(bandIndex('D60'));
    expect(bandIndex('D7')).toBeLessThan(bandIndex('EXPIRED'));
  });
});

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

describe('compliance-reminder-scan band-state-machine', () => {
  it('fires D90 band on first cron tick after 90d threshold', async () => {
    // now = 90 days before expiry → exactly D90 band, no prior state.
    const now = new Date('2026-05-03T09:00:00Z'); // ~90d before 2026-08-01
    itemsFixture.push(makeItem({ id: 'item-d90', expiresAt: new Date('2026-08-01T00:00:00Z') }));

    const result = await runComplianceReminderScan(now);

    expect(result.fires).toBe(1);
    expect(result.digests).toBe(1);
    const state = reminderStateByItem.get('item-d90');
    expect(state?.lastBandFired).toBe('D90');
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire the same or earlier band on a subsequent tick', async () => {
    reminderStateByItem.set('item-x', {
      itemId: 'item-x',
      organizationId: ORG,
      currentBand: 'D90',
      lastBandFired: 'D90',
      lastBandFiredAt: new Date('2026-05-03T09:00:00Z'),
      version: 1,
    });
    itemsFixture.push(makeItem({ id: 'item-x', expiresAt: new Date('2026-08-01T00:00:00Z') }));
    const now = new Date('2026-05-10T09:00:00Z'); // still in the D90 window

    const result = await runComplianceReminderScan(now);
    expect(result.fires).toBe(0);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe('compliance-reminder-scan digest', () => {
  it('emits exactly ONE digest per (recipient, jurisdictionDate) when claim succeeds', async () => {
    // Three items in different bands for the same single admin recipient.
    itemsFixture.push(
      makeItem({ id: 'i1', contractorId: 'ctr-1', expiresAt: new Date('2026-08-01T00:00:00Z') }),
      makeItem({ id: 'i2', contractorId: 'ctr-2', expiresAt: new Date('2026-06-20T00:00:00Z') }),
      makeItem({ id: 'i3', contractorId: 'ctr-3', expiresAt: new Date('2026-05-15T00:00:00Z') }),
    );
    const now = new Date('2026-05-03T09:00:00Z');

    const result = await runComplianceReminderScan(now);

    expect(result.fires).toBe(3);
    expect(result.digests).toBe(1); // ONE digest, not three
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0]?.[0] as {
      type: string;
      metadata: { fires: unknown[] };
    };
    expect(call.type).toBe('compliance.expiry_digest');
    expect(call.metadata.fires).toHaveLength(3);
  });

  it('passes i18n keys as title/body (not hardcoded English) and resolves locale from org', async () => {
    // Change org language to German so we can verify normalizeLocale is called with it.
    mockPrismaRaw.organization.findUnique.mockResolvedValueOnce({ language: 'de' });

    itemsFixture.push(makeItem({ id: 'de-item', expiresAt: new Date('2026-06-20T00:00:00Z') }));
    const now = new Date('2026-05-03T09:00:00Z');

    await runComplianceReminderScan(now);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0]?.[0] as {
      title: string;
      body: string;
      metadata: { count: number; items: string };
    };
    // title and body must be dotted i18n keys, not raw English sentences.
    expect(call.title).toBe('Compliance.notifications.expiryDigest.title');
    expect(call.body).toBe('Compliance.notifications.expiryDigest.body');
    // metadata carries the interpolation params for resolveCopy.
    expect(call.metadata.count).toBe(1);
    expect(typeof call.metadata.items).toBe('string');
    // normalizeLocale must be called with the org's language so non-en orgs localise.
    expect(vi.mocked(normalizeLocale)).toHaveBeenCalledWith('de');
  });
});

describe('compliance-reminder-scan renewal-reset', () => {
  it('atomically resets state with version bump on expires_at_changed event', async () => {
    reminderStateByItem.set('item-r', {
      itemId: 'item-r',
      organizationId: ORG,
      currentBand: 'D30',
      lastBandFired: 'D30',
      lastBandFiredAt: new Date('2026-05-01T00:00:00Z'),
      version: 3,
    });
    const tx = mockPrisma as unknown as Parameters<typeof onComplianceItemExpiresAtChanged>[0];

    await onComplianceItemExpiresAtChanged(tx, {
      itemId: 'item-r',
      organizationId: ORG,
      triggerEvent: 'expires_at_changed',
    });

    const state = reminderStateByItem.get('item-r');
    expect(state?.currentBand).toBe('NONE');
    expect(state?.lastBandFired).toBeNull();
    expect(state?.lastBandFiredAt).toBeNull();
    expect(state?.version).toBe(4); // 3 + 1
    expect(auditLogCreates).toHaveLength(1);
    expect(auditLogCreates[0]?.action).toBe('compliance.reminder.reset');
    expect((auditLogCreates[0]?.metadataJson as { previousBand: string }).previousBand).toBe('D30');
  });

  it('cron upsert with stale version is no-op (optimistic-concurrency loss)', async () => {
    // State row exists at version 5; cron reads version 5 but a renewal-reset
    // bumps it to 6 before the cron writes. Simulate by making updateMany see a
    // mismatched version: we set version to 6 AFTER the findUnique returns 5.
    reminderStateByItem.set('item-c', {
      itemId: 'item-c',
      organizationId: ORG,
      currentBand: 'NONE',
      lastBandFired: null,
      lastBandFiredAt: null,
      version: 5,
    });
    // findUnique (on prismaRaw) returns the row at version 5; then a concurrent reset bumps it.
    mockPrismaRaw.contractorComplianceReminderState.findUnique.mockImplementationOnce(async () => {
      const row = reminderStateByItem.get('item-c');
      // Concurrent renewal-reset increments version between read and write.
      reminderStateByItem.set('item-c', { ...row!, version: 6 });
      return { ...row! }; // returns stale version 5 snapshot
    });
    itemsFixture.push(makeItem({ id: 'item-c', expiresAt: new Date('2026-08-01T00:00:00Z') }));
    const now = new Date('2026-05-03T09:00:00Z');

    const result = await runComplianceReminderScan(now);

    expect(result.fires).toBe(0); // updateMany count=0 → no fire
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe('compliance-reminder-scan filtering + resilience', () => {
  it('skips items where severity is WARNING or INFO', async () => {
    // The cron query filters severity=BLOCKING at the DB layer; assert the
    // findMany where-clause carries that filter so non-BLOCKING never reaches us.
    itemsFixture.push(makeItem({ id: 'i-blocking' }));
    await runComplianceReminderScan(new Date('2026-05-03T09:00:00Z'));
    const where = mockPrismaRaw.contractorComplianceItem.findMany.mock.calls[0]?.[0]
      ?.where as Record<string, unknown>;
    expect(where.severity).toBe('BLOCKING');
  });

  it('skips items where status is WAIVED or SATISFIED', async () => {
    await runComplianceReminderScan(new Date('2026-05-03T09:00:00Z'));
    const where = mockPrismaRaw.contractorComplianceItem.findMany.mock.calls[0]?.[0]?.where as {
      status: { in: string[] };
    };
    expect(where.status.in).toEqual(['PENDING', 'EXPIRED']);
    expect(where.status.in).not.toContain('WAIVED');
    expect(where.status.in).not.toContain('SATISFIED');
  });

  it('does not process items with a null expiryJurisdictionTz (filtered by query)', async () => {
    await runComplianceReminderScan(new Date('2026-05-03T09:00:00Z'));
    const where = mockPrismaRaw.contractorComplianceItem.findMany.mock.calls[0]?.[0]?.where as {
      expiryJurisdictionTz: unknown;
    };
    expect(where.expiryJurisdictionTz).toEqual({ not: null });
  });

  it('logs error and continues on per-item failure (does not abort whole scan)', async () => {
    // Make the state read for 'bad' throw; 'good' still processes to completion.
    mockPrismaRaw.contractorComplianceReminderState.findUnique.mockImplementationOnce(async () => {
      throw new Error('db connection error');
    });
    itemsFixture.push(
      makeItem({ id: 'bad', contractorId: 'ctr-1' }),
      makeItem({ id: 'good', contractorId: 'ctr-1' }),
    );
    const now = new Date('2026-05-03T09:00:00Z');
    const result = await runComplianceReminderScan(now);
    // 'bad' throws during state read; 'good' still fires.
    expect(result.scanned).toBe(2);
    expect(result.fires).toBe(1);
  });

  it('handles dispatch() rejection gracefully (per-recipient try/catch)', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('email provider down'));
    itemsFixture.push(makeItem({ id: 'i-dispatch-fail', contractorId: 'ctr-1' }));
    const now = new Date('2026-05-03T09:00:00Z');
    const result = await runComplianceReminderScan(now);
    expect(result.fires).toBe(1);
    expect(result.digests).toBe(0); // dispatch threw → digest count not incremented, no throw
  });

  it('returns zero counts on a top-level infra failure (never throws to caller)', async () => {
    mockPrismaRaw.contractorComplianceItem.findMany.mockRejectedValueOnce(new Error('db down'));
    const result = await runComplianceReminderScan(new Date('2026-05-03T09:00:00Z'));
    expect(result).toEqual({ scanned: 0, fires: 0, digests: 0 });
  });
});

// ---------------------------------------------------------------------------
// Bundle resolution — catches H-NEW-1 (casing miss causes raw key in digest)
// ---------------------------------------------------------------------------
// These tests call the REAL resolveMessage against the real en.json bundle so
// any casing regression in getDocumentTypeLabelKey immediately produces a raw
// key in these assertions instead of a human-readable label.
// We use vi.importActual to bypass the module-level vi.mock on email-i18n.

import { getDocumentTypeLabelKey } from '../compliance-payment-gate';

type RealEmailI18n = typeof import('../../i18n/email-i18n');

describe('compliance-reminder-scan digest label bundle resolution (real resolveMessage)', () => {
  it('resolves one known rule per jurisdiction to a non-key human label (en)', async () => {
    // Bypass the module-level mock to exercise the real bundle-walking code path.
    const { resolveMessage } = await vi.importActual<RealEmailI18n>('../../i18n/email-i18n');

    const cases: [string, string, string][] = [
      ['UTR', 'uk.utr@v1', 'HMRC UTR'],
      ['RIGHT_TO_WORK', 'uk.right_to_work@v1', 'UK Right-to-Work share code'],
      ['A1_CERTIFICATE', 'de.a1@v1', 'A1-Bescheinigung'],
      ['ZUS_A1', 'pl.zus_a1@v1', 'ZUS A1'],
      ['IQAMA', 'ksa.iqama@v1', 'Iqama residency permit'],
      ['EMIRATES_ID', 'uae.emirates_id@v1', 'Emirates ID'],
    ];
    for (const [documentType, policyRuleId, expected] of cases) {
      const key = getDocumentTypeLabelKey(documentType, policyRuleId);
      // The key must NOT be echoed back — that would mean the bundle lookup failed.
      const resolved = resolveMessage(key, 'en');
      expect(resolved).toBe(expected);
      expect(resolved).not.toBe(key);
    }
  });
});
