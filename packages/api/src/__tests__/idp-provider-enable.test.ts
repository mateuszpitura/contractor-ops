// ---------------------------------------------------------------------------
// enableProviderForOrg mutation tests.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

const { mockPrisma, orgUpdate, settingsState, signoffStatus } = vi.hoisted(() => {
  const settingsState = { settingsJson: {} as Record<string, unknown> };
  const orgUpdate = vi.fn(async (args: { data: { settingsJson: Record<string, unknown> } }) => {
    settingsState.settingsJson = args.data.settingsJson;
    return {};
  });
  const signoffStatus = {
    gws: 'PENDING' as 'PENDING' | 'APPROVED',
    slack: 'PENDING' as 'PENDING' | 'APPROVED',
  };
  const mockPrisma = {
    organization: {
      // Serves BOTH the tenant-middleware org-meta lookup (needs status ACTIVE)
      // and the router's settingsJson read.
      findUnique: vi.fn(async () => ({
        id: ORG_A,
        dataRegion: 'EU',
        status: 'ACTIVE',
        name: 'Test Org',
        settingsJson: settingsState.settingsJson,
      })),
      update: orgUpdate,
    },
    // Executes the callback with the same mock so findUnique/update calls are captured.
    $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { mockPrisma, orgUpdate, settingsState, signoffStatus };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

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

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/feature-flags')>();
  return {
    ...actual,
    getFlagSignoff: vi.fn((key: string) => {
      if (key === 'module.idp-deprovisioning-gws') return { status: signoffStatus.gws };
      if (key === 'module.idp-deprovisioning-slack') return { status: signoffStatus.slack };
      return;
    }),
  };
});

vi.mock('@contractor-ops/idp-saga', () => ({
  canStartDeprovisioning: vi.fn(),
  MAX_ATTEMPTS: 3,
  recomputeRunStatus: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createLogger: vi.fn(() => noop),
    createTrpcLogger: vi.fn(() => noop),
    createCronLogger: vi.fn(() => noop),
    createIntegrationLogger: vi.fn(() => noop),
    createWebhookLogger: vi.fn(() => noop),
    getIdpAuditLogger: vi.fn(() => noop),
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    generateRequestId: vi.fn(() => 'r-1'),
    logger: noop,
    PII_MASK_PATHS: [],
    PII_MASK_KEYWORDS: [],
    LOG_BODY_INCLUDE_PREFIXES: [],
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

import { createCallerFactory } from '../init';
import { appRouter } from '../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID) {
  const session = {
    session: {
      id: `s-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 't',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'T',
      email: `${userId}@x.com`,
      emailVerified: true,
      image: null,
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

beforeEach(() => {
  vi.clearAllMocks();
  settingsState.settingsJson = {};
  signoffStatus.gws = 'PENDING';
  signoffStatus.slack = 'PENDING';
  delete process.env.FLAG_SIGNOFF_BYPASS;
});

describe('enableProviderForOrg (Phase 77 D-15)', () => {
  it('refuses to enable a provider whose signoff flag is PENDING', async () => {
    await expect(
      makeCaller().deprovisioning.enableProviderForOrg({
        provider: 'GOOGLE_WORKSPACE',
        enabled: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it('enables a provider when its flag is APPROVED', async () => {
    signoffStatus.gws = 'APPROVED';
    const result = await makeCaller().deprovisioning.enableProviderForOrg({
      provider: 'GOOGLE_WORKSPACE',
      enabled: true,
    });
    expect(result).toEqual({ ok: true, provider: 'GOOGLE_WORKSPACE', enabled: true });
    expect(settingsState.settingsJson).toMatchObject({
      idpDeprovisioningEnabled: { GOOGLE_WORKSPACE: true },
    });
  });

  it('GWS and Slack toggle independently (D-15)', async () => {
    signoffStatus.gws = 'APPROVED';
    signoffStatus.slack = 'APPROVED';
    const caller = makeCaller();
    await caller.deprovisioning.enableProviderForOrg({
      provider: 'GOOGLE_WORKSPACE',
      enabled: true,
    });
    await caller.deprovisioning.enableProviderForOrg({ provider: 'SLACK', enabled: false });
    expect(settingsState.settingsJson).toMatchObject({
      idpDeprovisioningEnabled: { GOOGLE_WORKSPACE: true, SLACK: false },
    });
  }, 20000);

  it('can disable a provider regardless of flag status', async () => {
    const result = await makeCaller().deprovisioning.enableProviderForOrg({
      provider: 'SLACK',
      enabled: false,
    });
    expect(result.enabled).toBe(false);
    expect(orgUpdate).toHaveBeenCalled();
  });

  it('FLAG_SIGNOFF_BYPASS=local permits enable while PENDING', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    const result = await makeCaller().deprovisioning.enableProviderForOrg({
      provider: 'GOOGLE_WORKSPACE',
      enabled: true,
    });
    expect(result.enabled).toBe(true);
  });
});
