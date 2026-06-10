// compliance.overrideItem mutation tests.
//
// Uses the canonical router-caller harness (mirrors routers/__tests__/classification.test.ts):
// a hoisted mockPrisma with an observable $transaction, full @contractor-ops/db +
// @contractor-ops/auth + logger + feature-flags mocks, and createCallerFactory(appRouter).
// The classification router is flag-gated (module.classification-engine) so the
// feature-flags mock force-enables it.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const ITEM_ID = 'clitemaaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';

const { mockPrisma, auditWriteSpy } = vi.hoisted(() => {
  const item = {
    id: 'clitemaaaaaaaaaaaaaaaaaaaaa',
    contractorId: 'clcontractoraaaaaaaaaaaaaaa',
    organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
    status: 'EXPIRED',
    severity: 'BLOCKING',
  };
  const contractorComplianceItem = {
    findFirst: vi.fn(async () => ({ ...item })),
    update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
      ...item,
      ...args.data,
    })),
  };
  const auditLog = {
    create: vi.fn(async () => ({ id: 'audit_1' })),
    findMany: vi.fn(async () => []),
  };
  const organization = {
    findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'GB' })),
  };
  const base = { contractorComplianceItem, auditLog, organization };
  const mockPrisma = {
    ...base,
    $transaction: vi.fn(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { mockPrisma, auditWriteSpy: vi.fn(async () => undefined) };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('../services/audit-writer', () => ({ writeAuditLog: auditWriteSpy }));

vi.mock('@sentry/node', () => {
  const span = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
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
    startSpan: vi.fn((_o: unknown, fn: (s: typeof span) => unknown) => fn(span)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const enabledBag = {
    values: { 'module.classification-engine': true },
    isEnabled: (key: string) => key === 'module.classification-engine',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => enabledBag),
    lazyFlagBag: vi.fn(() => enabledBag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

import { authApi } from '@contractor-ops/auth';
import { createCallerFactory } from '../init';
import { appRouter } from '../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(role = 'admin') {
  const session = {
    session: {
      id: `session-${USER_ID}`,
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'Admin Jane',
      email: `${USER_ID}@example.com`,
      emailVerified: true,
      image: null,
      role,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
  mockPrisma.contractorComplianceItem.findFirst.mockResolvedValue({
    id: ITEM_ID,
    contractorId: CONTRACTOR_ID,
    organizationId: ORG_ID,
    status: 'EXPIRED',
    severity: 'BLOCKING',
  } as never);
});

describe('compliance-override-mutation happy-path', () => {
  it('flips ContractorComplianceItem.status to WAIVED and writes audit log', async () => {
    const caller = makeCaller();
    const out = (await caller.classification.overrideItem({
      itemId: ITEM_ID,
      reasonCategory: 'TEMPORARY_GRACE_PERIOD',
      reasonNote: 'Renewal pending — admin grace period for 30 days',
    })) as { status: string };
    expect(out.status).toBe('WAIVED');
    expect(mockPrisma.contractorComplianceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'WAIVED',
          waivedReason: 'ADMIN_MANUAL_WAIVE',
          waivedReasonCategory: 'TEMPORARY_GRACE_PERIOD',
        }),
      }),
    );
  });

  it('sets waivedReason=ADMIN_MANUAL_WAIVE AND waivedReasonCategory + waivedReasonNote per input', async () => {
    const caller = makeCaller();
    await caller.classification.overrideItem({
      itemId: ITEM_ID,
      reasonCategory: 'ADMIN_CORRECTION',
      reasonNote: 'Misclassified as missing — doc was on file all along',
    });
    const lastCall = mockPrisma.contractorComplianceItem.update.mock.calls.at(-1) as
      | [{ data: Record<string, unknown> }]
      | undefined;
    expect(lastCall?.[0].data.waivedReason).toBe('ADMIN_MANUAL_WAIVE');
    expect(lastCall?.[0].data.waivedReasonCategory).toBe('ADMIN_CORRECTION');
    expect(lastCall?.[0].data.waivedReasonNote).toContain('Misclassified');
  });
});

describe('compliance-override-mutation permission', () => {
  it('rejects callers without compliance:override permission with FORBIDDEN', async () => {
    vi.mocked(authApi.hasPermission).mockResolvedValue({ success: false } as never);
    const caller = makeCaller('readonly');
    await expect(
      caller.classification.overrideItem({
        itemId: ITEM_ID,
        reasonCategory: 'OTHER',
        reasonNote: 'A sufficiently long override rationale here.',
      }),
    ).rejects.toThrow();
  });
});

describe('compliance-override-mutation freetext-min', () => {
  it('rejects reasonNote shorter than 20 chars with BAD_REQUEST', async () => {
    const caller = makeCaller();
    await expect(
      caller.classification.overrideItem({
        itemId: ITEM_ID,
        reasonCategory: 'OTHER',
        reasonNote: 'too short',
      }),
    ).rejects.toThrow();
  });

  it('rejects reasonCategory not in closed enum with BAD_REQUEST', async () => {
    const caller = makeCaller();
    await expect(
      caller.classification.overrideItem({
        itemId: ITEM_ID,
        // @ts-expect-error — bad reason category should fail Zod
        reasonCategory: 'this-is-not-in-the-enum',
        reasonNote: 'a'.repeat(25),
      }),
    ).rejects.toThrow();
  });
});

describe('compliance-override-mutation audit-emission', () => {
  it('emits AuditLog action=compliance.item.overridden with metadata.itemId + previousStatus', async () => {
    const caller = makeCaller();
    await caller.classification.overrideItem({
      itemId: ITEM_ID,
      reasonCategory: 'ENGAGEMENT_CHANGED',
      reasonNote: 'Engagement type changed from B2B to employment',
    });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance.item.overridden',
        resourceType: 'CONTRACTOR',
        resourceId: CONTRACTOR_ID,
        metadata: expect.objectContaining({
          itemId: ITEM_ID,
          reasonCategory: 'ENGAGEMENT_CHANGED',
          previousStatus: 'EXPIRED',
        }),
      }),
    );
  });

  it('already-WAIVED item is rejected with PRECONDITION_FAILED (no double-override)', async () => {
    mockPrisma.contractorComplianceItem.findFirst.mockResolvedValueOnce({
      id: ITEM_ID,
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      status: 'WAIVED',
      severity: 'BLOCKING',
    } as never);
    const caller = makeCaller();
    await expect(
      caller.classification.overrideItem({
        itemId: ITEM_ID,
        reasonCategory: 'OTHER',
        reasonNote: 'Attempting to override an already-waived item here.',
      }),
    ).rejects.toThrow();
  });
});
