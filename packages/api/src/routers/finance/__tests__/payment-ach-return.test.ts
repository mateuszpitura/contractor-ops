// Reachable ACH return-file ingestion (paymentCore.ingestAchReturnFile).
//
// Proves the tRPC entry point — not just the underlying service — is wired,
// gated, tenant-scoped, and idempotent. An operator uploads the NACHA return
// file their bank produced; the procedure parses it and applies the returns to
// the run's live PaymentRunItems.
//
// Invariants exercised through the caller:
//   - flip: an R01 entry matching a live EXPORTED item flips it to FAILED with a
//     reason naming R01, returning { failed:1, unmatched:0 }
//   - idempotency: a second identical upload is a no-op ({ failed:0, skipped:1 })
//   - operator-safety: a wrong-run / mis-uploaded file surfaces unmatched > 0
//     with failed:0 rather than an indistinguishable all-zeros no-op
//   - tenant isolation: a foreign-org run flips nothing (its entry is unmatched)
//   - gating: assertUsExpansionEnabled throws when the US surface is off
//   - benign no-op vs. malformed: a non-return file returns zeros without
//     throwing, while a file carrying return addenda that parses to nothing is a
//     BAD_REQUEST

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Controllable module state (hoisted so the mock factories can close over it)
// ---------------------------------------------------------------------------

const { flagState, dbState } = vi.hoisted(() => ({
  flagState: { usExpansion: true },
  dbState: { current: null as unknown },
}));

// ---------------------------------------------------------------------------
// Mocks — the minimal surface paymentCoreRouter's import graph needs to load
// and run hermetically (no live Postgres / Redis / Unleash / provider SDK).
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/feature-flags', () => ({
  // assertUsExpansionEnabled evaluates 'module.us-expansion'; every other flag
  // is irrelevant to ingestAchReturnFile and defaults enabled.
  evaluate: (key: string) => ({
    enabled: key === 'module.us-expansion' ? flagState.usExpansion : true,
    reason: 'mock',
  }),
}));

vi.mock('@contractor-ops/db', () => {
  const passthrough = <T>(c: T) => c;
  return {
    prisma: {},
    prismaRaw: {},
    withRlsTransactions: passthrough,
    withRlsReads: passthrough,
    withTenantScope: vi.fn(passthrough),
    withSoftDelete: vi.fn(passthrough),
    tenantStore: {
      run: (_ctx: unknown, fn: () => unknown) => fn(),
      getStore: vi.fn(() => ({ region: 'US' })),
    },
    createTenantClient: vi.fn(() => dbState.current),
    createTenantClientFrom: vi.fn(() => dbState.current),
    getRegionalClient: vi.fn(() => dbState.current),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async () => ({
    id: 'org-1',
    dataRegion: 'US',
    status: 'ACTIVE',
    name: 'US Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  invalidateOrgBranding: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('@contractor-ops/integrations', () => ({
  MockModernTreasuryAdapter: class {},
  StripeTreasuryAdapter: class {},
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  });
  return {
    createLogger: vi.fn(stub),
    createTrpcLogger: vi.fn(stub),
    createWebhookLogger: vi.fn(stub),
    createCronLogger: vi.fn(stub),
    createIntegrationLogger: vi.fn(stub),
    getIdpAuditLogger: vi.fn(stub),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: Object.assign(stub(), { child: () => stub() }),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import * as E from '../../../errors';
import { createCallerFactory, router } from '../../../init';
import { paymentCoreRouter } from '../payment-core';

// paymentCoreRouter merges into paymentRouter under no sub-namespace and mounts
// at `payment` in appRouter, so `payment.ingestAchReturnFile` here is the real
// reachable path.
const testRouter = router({ payment: paymentCoreRouter });
const createCaller = createCallerFactory(testRouter);

const ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';
const USER_ID = 'user-1';
const RUN_ID = 'clrun000000000000000000001';
const INVOICE_NUMBER = 'INV-US-001';

function makeCaller(userId: string, orgId: string) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

const caller = makeCaller(USER_ID, ORG_ID);

// ---------------------------------------------------------------------------
// Fixed-width NACHA return-record fixtures (mirroring the generator offsets the
// parser reads: entry-detail type 6 + its addenda-99 type 7 return record).
// ---------------------------------------------------------------------------

function fixedWidth(segments: Array<[number, string]>, len = 94): string {
  const chars = Array<string>(len).fill(' ');
  for (const [offset, value] of segments) {
    for (let i = 0; i < value.length && offset + i < len; i += 1) {
      chars[offset + i] = value[i] ?? ' ';
    }
  }
  return chars.join('');
}

function entryDetail(opts: { individualId: string; amountMinor: number; trace: string }): string {
  return fixedWidth([
    [0, '6'],
    [29, String(opts.amountMinor).padStart(10, '0')],
    [39, opts.individualId],
    [79, opts.trace],
  ]);
}

function addenda99(opts: { returnCode: string; info: string }): string {
  return fixedWidth([
    [0, '7'],
    [1, '99'],
    [3, opts.returnCode],
    [35, opts.info],
  ]);
}

function returnFile(individualId: string, returnCode: string): string {
  return [
    entryDetail({ individualId, amountMinor: 50_000, trace: 'TRACE0000000001' }),
    addenda99({ returnCode, info: `${returnCode} returned by RDFI` }),
  ].join('\r\n');
}

// ---------------------------------------------------------------------------
// Stateful in-memory Prisma stub. `paymentRunItem.update` mutates the seeded
// item in place so a subsequent `findMany` observes the persisted FAILED status
// — the idempotency guarantee is only meaningful if re-load reflects the flip.
// ---------------------------------------------------------------------------

type RunItem = {
  id: string;
  status: string;
  failureReason: string | null;
  paymentReference: string | null;
  organizationId: string;
  paymentRunId: string;
  invoice: { invoiceNumber: string | null } | null;
};

function makeItem(overrides: Partial<RunItem> = {}): RunItem {
  return {
    id: 'item-1',
    status: 'EXPORTED',
    failureReason: null,
    paymentReference: null,
    organizationId: ORG_ID,
    paymentRunId: RUN_ID,
    invoice: { invoiceNumber: INVOICE_NUMBER },
    ...overrides,
  };
}

function seedDb(items: RunItem[]) {
  const auditCreate = vi.fn(async () => ({}));
  const findMany = vi.fn(
    async ({
      where,
      include: _include,
    }: {
      where: { paymentRunId: string; organizationId: string };
      include?: unknown;
    }) =>
      items.filter(
        i => i.paymentRunId === where.paymentRunId && i.organizationId === where.organizationId,
      ),
  );
  const update = vi.fn(
    async ({ where, data }: { where: { id: string }; data: Partial<RunItem> }) => {
      const item = items.find(i => i.id === where.id);
      if (item) Object.assign(item, data);
      return item;
    },
  );
  const db = {
    paymentRun: {
      findFirst: vi.fn(async () => ({ runNumber: 'RUN-001' })),
    },
    paymentRunItem: { findMany, update },
    auditLog: { create: auditCreate },
    member: {
      findMany: vi.fn(async () => [{ userId: 'user-1', role: 'admin' }]),
    },
    $executeRawUnsafe: vi.fn(async () => 1),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  dbState.current = db;
  return { items, auditCreate, findMany, update };
}

function auditActions(auditCreate: ReturnType<typeof vi.fn>): string[] {
  return auditCreate.mock.calls.map(call => (call[0] as { data: { action: string } }).data.action);
}

beforeEach(() => {
  flagState.usExpansion = true;
  dbState.current = null;
});

describe('paymentCore.ingestAchReturnFile — reachable failure transition', () => {
  it('flips a matched EXPORTED item to FAILED with an R01 reason and reports failed:1/unmatched:0', async () => {
    const { items, auditCreate } = seedDb([makeItem()]);

    const result = await caller.payment.ingestAchReturnFile({
      runId: RUN_ID,
      returnFileText: returnFile(INVOICE_NUMBER, 'R01'),
    });

    expect(result).toEqual({ failed: 1, advisory: 0, skipped: 0, unmatched: 0 });
    expect(items[0]?.status).toBe('FAILED');
    expect(items[0]?.failureReason).toContain('R01');
    // Per-item transition audit (from the service) plus the ingestion-summary
    // audit (from the procedure) are both written.
    const actions = auditActions(auditCreate);
    expect(actions).toContain('payment_run.ach_return_applied');
    expect(actions).toContain('payment_run.ach_return_ingested');
  });

  it('carries no bank data in the masked ingestion-summary audit', async () => {
    const file = returnFile(INVOICE_NUMBER, 'R01');
    const { auditCreate } = seedDb([makeItem()]);

    await caller.payment.ingestAchReturnFile({ runId: RUN_ID, returnFileText: file });

    const summaryRow = auditCreate.mock.calls
      .map(call => call[0] as { data: { action: string; metadataJson: unknown } })
      .find(row => row.data.action === 'payment_run.ach_return_ingested');
    const serialized = JSON.stringify(summaryRow?.data.metadataJson);
    expect(serialized).not.toContain('routingNumber');
    expect(serialized).not.toContain('accountNumber');
    // Raw file text (with its fixed-width records) is never persisted.
    expect(serialized).not.toContain('TRACE0000000001');
  });
});

describe('paymentCore.ingestAchReturnFile — idempotency on re-upload', () => {
  it('is a no-op on a second identical upload (failed:0, skipped:1)', async () => {
    const { items } = seedDb([makeItem()]);
    const file = returnFile(INVOICE_NUMBER, 'R01');

    const first = await caller.payment.ingestAchReturnFile({ runId: RUN_ID, returnFileText: file });
    const second = await caller.payment.ingestAchReturnFile({
      runId: RUN_ID,
      returnFileText: file,
    });

    expect(first.failed).toBe(1);
    expect(second).toEqual({ failed: 0, advisory: 0, skipped: 1, unmatched: 0 });
    expect(items[0]?.status).toBe('FAILED');
  });
});

describe('paymentCore.ingestAchReturnFile — operator-safety (unmatched)', () => {
  it('surfaces unmatched > 0 for a wrong-run / mis-uploaded file instead of a silent no-op', async () => {
    const { items } = seedDb([makeItem()]);

    const result = await caller.payment.ingestAchReturnFile({
      runId: RUN_ID,
      returnFileText: returnFile('INV-WRONG-999', 'R01'),
    });

    expect(result.failed).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(items[0]?.status).toBe('EXPORTED');
  });

  it('flips nothing for a run owned by another org (its entry is unmatched)', async () => {
    const { items } = seedDb([makeItem({ organizationId: OTHER_ORG_ID })]);

    const result = await caller.payment.ingestAchReturnFile({
      runId: RUN_ID,
      returnFileText: returnFile(INVOICE_NUMBER, 'R01'),
    });

    expect(result.failed).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(items[0]?.status).toBe('EXPORTED');
  });
});

describe('paymentCore.ingestAchReturnFile — US-expansion gating', () => {
  it('rejects with US_EXPANSION_DISABLED when the surface is off, before touching payment state', async () => {
    flagState.usExpansion = false;
    const { items, findMany } = seedDb([makeItem()]);

    await expect(
      caller.payment.ingestAchReturnFile({
        runId: RUN_ID,
        returnFileText: returnFile(INVOICE_NUMBER, 'R01'),
      }),
    ).rejects.toMatchObject({ message: E.US_EXPANSION_DISABLED });

    expect(findMany).not.toHaveBeenCalled();
    expect(items[0]?.status).toBe('EXPORTED');
  });
});

describe('paymentCore.ingestAchReturnFile — benign no-op vs. malformed', () => {
  it('returns all-zeros without throwing for a non-return file', async () => {
    seedDb([makeItem()]);

    const result = await caller.payment.ingestAchReturnFile({
      runId: RUN_ID,
      returnFileText: '101 021000021 1234567890 not a return record\r\n9999999',
    });

    expect(result).toEqual({ failed: 0, advisory: 0, skipped: 0, unmatched: 0 });
  });

  it('rejects a file carrying return addenda that parses to nothing (structurally broken)', async () => {
    seedDb([makeItem()]);
    // A type-7 addenda-99 return marker with no preceding well-formed entry.
    const broken = addenda99({ returnCode: 'R01', info: 'orphan addenda' });

    await expect(
      caller.payment.ingestAchReturnFile({ runId: RUN_ID, returnFileText: broken }),
    ).rejects.toMatchObject({ message: E.PAYMENT_ACH_RETURN_FILE_INVALID });
  });
});
