// ---------------------------------------------------------------------------
// Per-provider IdP deprovisioning connection-router tests.
// ---------------------------------------------------------------------------
//
// Verifies the entra/okta/github routers: the per-org enable toggle is gated by
// the provider signoff flag (rejects while PENDING, succeeds under
// FLAG_SIGNOFF_BYPASS=local), reads organizationId from session context (never
// from input — the input schema has no tenant id), writes an audit row, and
// never echoes a credential/secret in the response.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

const { mockPrisma, orgSettings, flagStatus, auditWrites } = vi.hoisted(() => {
  const orgSettings = { value: {} as Record<string, unknown> };
  const flagStatus = { value: 'PENDING' as 'PENDING' | 'APPROVED' };
  const auditWrites: Record<string, unknown>[] = [];
  const mockPrisma = {
    organization: {
      // Returns both the tenant-middleware meta (status/dataRegion) AND the
      // settingsJson the routers read — the same findUnique serves both callers.
      findUnique: vi.fn(async () => ({
        status: 'ACTIVE',
        dataRegion: 'EU',
        settingsJson: orgSettings.value,
      })),
      update: vi.fn(async (args: { data: { settingsJson: Record<string, unknown> } }) => {
        orgSettings.value = args.data.settingsJson;
        return { id: ORG_A };
      }),
    },
    // Executes the callback with the same mock so findUnique/update calls are captured.
    $transaction: vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { mockPrisma, orgSettings, flagStatus, auditWrites };
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
    run: (_ctx: unknown, fn: () => unknown) => fn(),
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
    getFlagSignoff: vi.fn((_key: string) => ({ status: flagStatus.value })),
  };
});

vi.mock('@contractor-ops/logger', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createWebhookLogger: vi.fn(() => noop),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: noop,
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
    createIntegrationLogger: vi.fn(() => noop),
    createLogger: vi.fn(() => noop),
    createTrpcLogger: vi.fn(() => noop),
    createCronLogger: vi.fn(() => noop),
    getIdpAuditLogger: vi.fn(() => noop),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async (input: Record<string, unknown>) => {
    auditWrites.push(input);
  }),
}));

import { createCallerFactory } from '../../../init';
import { appRouter } from '../../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID) {
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
  orgSettings.value = {};
  flagStatus.value = 'PENDING';
  auditWrites.length = 0;
  delete process.env.FLAG_SIGNOFF_BYPASS;
  vi.clearAllMocks();
});

// The per-provider routers (entra/okta/github) were consolidated into
// `deprovisioning.enableProviderForOrg`. These tests verify that the unified
// procedure correctly handles each provider.
// The appRouter (full root namespace graph) is heavy to import per test; the
// default 5s timeout is occasionally hit on a cold fork worker. 20s mirrors the
// idp-provider-enable.test.ts precedent.
describe('IdP deprovisioning per-provider toggle via deprovisioning.enableProviderForOrg', {
  timeout: 20000,
}, () => {
  for (const provider of ['ENTRA', 'OKTA', 'GITHUB'] as const) {
    describe(`${provider} provider`, () => {
      it('enableProviderForOrg REJECTS while the signoff flag is PENDING and no bypass', async () => {
        flagStatus.value = 'PENDING';
        const caller = makeCaller();
        await expect(
          caller.deprovisioning.enableProviderForOrg({ provider, enabled: true }),
        ).rejects.toThrow();
      });

      it('enableProviderForOrg SUCCEEDS under FLAG_SIGNOFF_BYPASS=local and persists the per-org toggle', async () => {
        process.env.FLAG_SIGNOFF_BYPASS = 'local';
        const caller = makeCaller();
        const result = await caller.deprovisioning.enableProviderForOrg({
          provider,
          enabled: true,
        });
        expect(result.ok).toBe(true);
        expect(result.enabled).toBe(true);
        const persisted = (orgSettings.value.idpDeprovisioningEnabled ?? {}) as Record<
          string,
          boolean
        >;
        expect(persisted[provider]).toBe(true);
      });

      it('enableProviderForOrg SUCCEEDS when the flag is APPROVED', async () => {
        flagStatus.value = 'APPROVED';
        const caller = makeCaller();
        const result = await caller.deprovisioning.enableProviderForOrg({
          provider,
          enabled: true,
        });
        expect(result.ok).toBe(true);
      });

      it('enableProviderForOrg writes an audit row scoped to the session organizationId', async () => {
        flagStatus.value = 'APPROVED';
        const caller = makeCaller();
        await caller.deprovisioning.enableProviderForOrg({ provider, enabled: true });
        expect(auditWrites).toHaveLength(1);
        expect(auditWrites[0]?.organizationId).toBe(ORG_A);
        expect(auditWrites[0]?.actorId).toBe(USER_ID);
      });

      it('enableProviderForOrg response contains NO credential/secret field', async () => {
        flagStatus.value = 'APPROVED';
        const caller = makeCaller();
        const result = await caller.deprovisioning.enableProviderForOrg({
          provider,
          enabled: true,
        });
        const json = JSON.stringify(result).toLowerCase();
        expect(json).not.toMatch(/secret|token|credential|apikey|api_key|client_secret/);
      });
    });
  }
});
