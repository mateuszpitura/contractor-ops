/**
 * Google Workspace router — syncStatus, connection errors, listDirectory, bulkImport, triggerSync.
 * Uses `googleWorkspaceRouter` in isolation with mocked `@contractor-ops/integrations` + auth + QStash.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorg00000000000000000001';
const USER_ID = 'cluser0000000000000000001';
const CONN_ID = 'clconn0000000000000000001';

const sampleGoogleUser = {
  id: 'gw-u1',
  primaryEmail: 'member@example.com',
  name: {
    givenName: 'Ada',
    familyName: 'Lovelace',
    fullName: 'Ada Lovelace',
  },
  thumbnailPhotoUrl: null as string | null,
  orgUnitPath: '/',
  organizations: [] as { primary?: boolean; department?: string }[],
  isAdmin: false,
};

const {
  mockPrisma,
  mockAdapter,
  mockListUsers,
  mockListUserGroups,
  mockPublishJSON,
  mockGetSubscription,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPrisma: Record<string, unknown> = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    integrationSyncLog: {
      findFirst: vi.fn(),
    },
  };

  const mockListUsers = vi.fn(async () => [sampleGoogleUser]);
  const mockListUserGroups = vi.fn(async () => [
    { id: 'g1', email: 'grp@example.com', name: 'G', description: null },
  ]);

  const mockAdapter = {
    listAllDirectoryUsers: mockListUsers,
    listUserGroups: mockListUserGroups,
    refreshToken: vi.fn(async (c: unknown) => c),
  };

  const mockPublishJSON = vi.fn(async () => undefined);

  const mockGetSubscription = vi.fn(async () => ({
    id: 'sub_gws_mock',
    status: 'ACTIVE',
    tier: 'PRO',
  }));

  return {
    mockPrisma,
    mockAdapter,
    mockListUsers,
    mockListUserGroups,
    mockPublishJSON,
    mockGetSubscription,
  };
});

vi.mock('@contractor-ops/integrations', () => ({
  registerAllAdapters: vi.fn(),
  getAdapter: vi.fn(() => mockAdapter),
  decryptCredentials: vi.fn(() => ({
    accessToken: 'access-token',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })),
  encryptCredentials: vi.fn(() => 'encrypted-ref'),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({
    schedules: {
      create: vi.fn(async () => ({ scheduleId: 'sched-new' })),
      delete: vi.fn(async () => undefined),
    },
    publishJSON: mockPublishJSON,
  })),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
      getFullOrganization: vi.fn(async () => ({
        members: [
          {
            user: { email: 'member@example.com' },
          },
        ],
      })),
      createInvitation: vi.fn(async () => ({ id: 'inv-1' })),
    },
  },
  authApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(async () => ({
      members: [{ user: { email: 'member@example.com' } }],
    })),
    createInvitation: vi.fn(async () => ({ id: 'inv-1' })),
  },
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

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
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
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(),
 warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../../services/billing-service', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
  getSubscription: mockGetSubscription,
  createCheckoutSession: vi.fn(async () => ({ url: 'https://stripe.test/checkout' })),
  createPortalSession: vi.fn(async () => ({})),
  getProrationPreview: vi.fn(async () => ({})),
  ensureStripeCustomer: vi.fn(async () => 'cus_mock'),
  createTopUpCheckoutSession: vi.fn(async () => ({})),
  updateSubscriptionSeatCount: vi.fn(async () => undefined),
}));

vi.mock('../../services/stripe-client', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/billing-constants', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set(['price_starter_monthly']),
  KNOWN_TOPUP_PRICE_IDS: new Set(['price_topup_10']),
  PRICE_TO_TIER_MAP: {},
}));

import { createCallerFactory } from '../../init';
import { googleWorkspaceRouter } from '../integrations/google-workspace';

const createCaller = createCallerFactory(googleWorkspaceRouter);

function makeCaller() {
  const session = {
    session: {
      id: 'sess-gws',
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
      name: 'Admin',
      email: 'admin@example.com',
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

const caller = makeCaller();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUBLIC_APP_URL = 'https://app.test';
  mockPrisma.integrationConnection.findFirst.mockReset();
  mockPrisma.integrationConnection.findUnique.mockReset();
  mockPrisma.integrationConnection.update.mockReset();
  mockPrisma.integrationSyncLog.findFirst.mockReset();
});

describe('googleWorkspaceRouter', () => {
  it('listDirectory throws NOT_FOUND when Google Workspace is not connected', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null);

    await expect(caller.listDirectory()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('syncStatus returns connected false when no integration row', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null);

    const out = await caller.syncStatus();

    expect(out).toEqual({ connected: false });
    expect(mockPrisma.integrationSyncLog.findFirst).not.toHaveBeenCalled();
  });

  it('syncStatus returns connection fields and last sync log when present', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      status: 'CONNECTED',
      configJson: { domain: 'example.com' },
      lastSyncAt: new Date('2026-01-15'),
    });
    mockPrisma.integrationSyncLog.findFirst.mockResolvedValueOnce({
      status: 'SUCCESS',
      startedAt: new Date('2026-01-14'),
      completedAt: new Date('2026-01-14'),
    });

    const out = await caller.syncStatus();

    expect(out).toMatchObject({
      connected: true,
      connectionId: CONN_ID,
      lastSyncStatus: 'SUCCESS',
    });
    expect(mockPrisma.integrationSyncLog.findFirst).toHaveBeenCalled();
  });

  it('listDirectory merges directory users with org membership flags', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      credentialsRef: 'ref',
      status: 'CONNECTED',
    });

    const out = await caller.listDirectory();

    expect(mockListUsers).toHaveBeenCalledWith('access-token');
    expect(out.users).toHaveLength(1);
    expect(out.users[0]?.alreadyExists).toBe(true);
    expect(out.stats).toEqual({ total: 1, alreadyImported: 1, new: 0 });
  });

  it('listUserGroups aggregates groups across emails', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      credentialsRef: 'ref',
      status: 'CONNECTED',
    });

    await caller.listUserGroups({
      userEmails: ['a@example.com', 'b@example.com'],
    });

    expect(mockListUserGroups).toHaveBeenCalled();
  });

  it('bulkImport creates invitations and updates connection config', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      credentialsRef: 'ref',
      status: 'CONNECTED',
      configJson: {},
    });

    const out = await caller.bulkImport({
      users: [
        {
          email: 'new@example.com',
          name: 'New User',
          googleUserId: 'gw-99',
        },
      ],
      defaultRole: 'readonly',
      groupRoleMappings: [],
      userRoleOverrides: {},
      userGroupMemberships: {},
    });

    expect(out.succeeded).toHaveLength(1);
    expect(out.succeeded[0]).toEqual({ email: 'new@example.com', role: 'readonly' });
    expect(mockPrisma.integrationConnection.update).toHaveBeenCalled();
  });

  it('triggerSync publishes QStash job when connection exists', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      credentialsRef: 'ref',
      status: 'CONNECTED',
    });

    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      configJson: { syncScheduleId: 'existing-schedule' },
    });

    await caller.triggerSync();

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          organizationId: ORG_ID,
          connectionId: CONN_ID,
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Tier gating
  // -------------------------------------------------------------------------

  describe('tier gating', () => {
    beforeEach(() => {
      mockGetSubscription.mockResolvedValue({
        id: 'sub_starter',
        status: 'ACTIVE',
        tier: 'STARTER',
      });
    });

    it('listUserGroups rejects STARTER tier with TIER_REQUIRED error', async () => {
      // Two assertions on the same path require two router invocations; each
      // currently amortises ~4s of router init/teardown so we extend the
      // timeout instead of forcing parallel calls.
      await expect(caller.listUserGroups({ userEmails: ['a@example.com'] })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });

      await expect(caller.listUserGroups({ userEmails: ['a@example.com'] })).rejects.toThrow(
        /TIER_REQUIRED/,
      );
    }, 15000);

    it('bulkImport rejects STARTER tier with TIER_REQUIRED error', async () => {
      await expect(
        caller.bulkImport({
          users: [{ email: 'new@example.com', name: 'New', googleUserId: 'gw-1' }],
          defaultRole: 'readonly',
          groupRoleMappings: [],
          userRoleOverrides: {},
          userGroupMemberships: {},
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('triggerSync rejects STARTER tier with TIER_REQUIRED error', async () => {
      await expect(caller.triggerSync()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });
});
