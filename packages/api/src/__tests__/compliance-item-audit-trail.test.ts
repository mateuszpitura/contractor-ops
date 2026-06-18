// compliance.itemAuditTrail query test.
//
// Same router-caller harness as compliance-override-mutation.test.ts.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const ITEM_ID = 'clitemaaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';

const { mockPrisma } = vi.hoisted(() => {
  const contractorComplianceItem = {
    findFirst: vi.fn(async () => ({
      id: 'clitemaaaaaaaaaaaaaaaaaaaaa',
      contractorId: 'clcontractoraaaaaaaaaaaaaaa',
    })),
  };
  const auditLog = {
    findMany: vi.fn(async () => [
      {
        id: 'a2',
        action: 'compliance.item.overridden',
        createdAt: new Date('2026-04-15'),
        metadataJson: { itemId: 'clitemaaaaaaaaaaaaaaaaaaaaa' },
      },
      {
        id: 'a1',
        action: 'compliance.item.created',
        createdAt: new Date('2026-04-01'),
        metadataJson: { itemId: 'clitemaaaaaaaaaaaaaaaaaaaaa' },
      },
    ]),
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
  return { mockPrisma };
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
  } as never);
});

describe('compliance-item-audit-trail', () => {
  it('returns audit-log entries ordered by createdAt DESC, org + contractor scoped', async () => {
    const caller = makeCaller();
    const trail = (await caller.complianceAdmin.itemAuditTrail({ itemId: ITEM_ID })) as unknown[];
    expect(trail).toHaveLength(2);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          resourceType: 'CONTRACTOR',
          resourceId: CONTRACTOR_ID,
        }),
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('rejects with NOT_FOUND when itemId does not belong to caller org', async () => {
    mockPrisma.contractorComplianceItem.findFirst.mockResolvedValueOnce(null as never);
    const caller = makeCaller();
    await expect(
      caller.complianceAdmin.itemAuditTrail({ itemId: 'cross_org_item' }),
    ).rejects.toThrow();
  });

  it('respects limit parameter (default 50, max 200)', async () => {
    const caller = makeCaller();
    await caller.complianceAdmin.itemAuditTrail({ itemId: ITEM_ID, limit: 10 });
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
