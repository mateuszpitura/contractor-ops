// Phase 79 · C9 (GULF-10) — drift override audit-logged + custom badge.
//
// A per-org drift override of a Nitaqat threshold catalogue or a UAE
// permitted-activity catalogue MUST call `writeAuditLog` with
// `metadata.custom: true` (which drives the "Custom — verify with adviser" badge),
// recording the before/after values and passing `tx` so the audit row commits
// atomically with the SaudizationConfig flag flip.
//
// Harness mirrors compliance-override-mutation.test.ts: a hoisted mockPrisma with
// an observable $transaction, full @contractor-ops/db + @contractor-ops/auth +
// logger + feature-flags mocks, createCallerFactory(appRouter), and a spied
// writeAuditLog. The Gulf models are mocked (Plan 02 landed generate-only — the
// live DB has no Gulf tables; router tests mock the db, never a real table).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const CONFIG_ID = 'clconfaaaaaaaaaaaaaaaaaaaaa';

const { mockPrisma, auditWriteSpy } = vi.hoisted(() => {
  const config = {
    id: 'clconfaaaaaaaaaaaaaaaaaaaaa',
    organizationId: 'clorgaaaaaaaaaaaaaaaaaaaaaa',
    thresholdsCustom: false,
    permittedActivityCatalogueCustom: false,
  };
  const saudizationConfig = {
    findFirst: vi.fn(async () => ({ ...config })),
    upsert: vi.fn(
      async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({
        ...config,
        ...args.update,
      }),
    ),
  };
  const auditLog = {
    create: vi.fn(async () => ({ id: 'audit_1' })),
    findMany: vi.fn(async () => []),
  };
  const organization = {
    findUnique: vi.fn(async () => ({ dataRegion: 'ME', status: 'ACTIVE' })),
    findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'SA' })),
  };
  const base = { saudizationConfig, auditLog, organization };
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
    getStore: vi.fn(() => ({ region: 'ME' })),
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
  mockPrisma.saudizationConfig.findFirst.mockResolvedValue({
    id: CONFIG_ID,
    organizationId: ORG_ID,
    thresholdsCustom: false,
    permittedActivityCatalogueCustom: false,
  } as never);
  mockPrisma.saudizationConfig.upsert.mockImplementation(
    async (args: { update: Record<string, unknown> }) =>
      ({
        id: CONFIG_ID,
        organizationId: ORG_ID,
        thresholdsCustom: false,
        permittedActivityCatalogueCustom: false,
        ...args.update,
      }) as never,
  );
});

describe('C9 (GULF-10) drift override audit-logged + custom badge', () => {
  it('calls writeAuditLog with metadata.custom = true when a Nitaqat threshold is overridden [79-05]', async () => {
    const caller = makeCaller();
    const out = (await caller.gulf.saudization.applyNitaqatThresholdOverride({
      custom: true,
    })) as { thresholdsCustom: boolean };

    expect(out.thresholdsCustom).toBe(true);
    expect(mockPrisma.saudizationConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ thresholdsCustom: true }),
      }),
    );
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'gulf.nitaqat_threshold.override',
        organizationId: ORG_ID,
        metadata: expect.objectContaining({ custom: true }),
      }),
    );
  });

  it('calls writeAuditLog with metadata.custom = true when a permitted-activity catalogue is overridden [79-05]', async () => {
    const caller = makeCaller();
    const out = (await caller.gulf.saudization.applyPermittedActivityOverride({
      custom: true,
    })) as { permittedActivityCatalogueCustom: boolean };

    expect(out.permittedActivityCatalogueCustom).toBe(true);
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'gulf.permitted_activity.override',
        organizationId: ORG_ID,
        metadata: expect.objectContaining({ custom: true }),
      }),
    );
  });

  it('records before/after values in the audit metadata and passes tx inside the transaction [79-05]', async () => {
    const caller = makeCaller();
    await caller.gulf.saudization.applyNitaqatThresholdOverride({ custom: true });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    const auditCall = auditWriteSpy.mock.calls.at(-1)?.[0] as
      | { metadata?: Record<string, unknown>; tx?: unknown }
      | undefined;
    expect(auditCall?.metadata).toMatchObject({
      before: { thresholdsCustom: false },
      after: { thresholdsCustom: true },
      custom: true,
    });
    // tx is threaded so the audit row commits atomically with the flag flip (D-17).
    expect(auditCall?.tx).toBeDefined();
  });

  it('rejects callers without settings:update permission [79-05]', async () => {
    vi.mocked(authApi.hasPermission).mockResolvedValue({ success: false } as never);
    const caller = makeCaller('readonly');
    await expect(
      caller.gulf.saudization.applyNitaqatThresholdOverride({ custom: true }),
    ).rejects.toThrow();
  });
});
