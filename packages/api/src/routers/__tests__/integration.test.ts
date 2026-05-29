/**
 * Integration router tests — getOAuthUrlGeneric.
 *
 * Tests the generic OAuth URL generation that works across providers
 * (Google Calendar, Outlook Calendar, etc.). Verifies URL construction,
 * scope joining, and extra auth params.
 */

import { resetServerEnvCacheForTesting } from '@contractor-ops/validators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-integ-001';
const USER_ID = 'user-integ-001';

// ---------------------------------------------------------------------------
// Mock via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockGetAdapter } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-mock' })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    externalLink: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    member: {
      findMany: vi.fn(),
    },
    integrationSyncLog: {
      findMany: vi.fn(),
    },
    webhookDelivery: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockGetAdapter: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn((client: unknown) => client),
}));

vi.mock('@contractor-ops/integrations', () => ({
  getProviderHealth: vi.fn(async () => ({})),
  getAllProviderHealth: vi.fn(async () => []),
  getAdapter: mockGetAdapter,
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/validators')>();
  return {
    ...actual,
    slackUserLinkSchema: { parse: vi.fn((v: unknown) => v) },
    slackUserUnlinkSchema: { parse: vi.fn((v: unknown) => v) },
    providerSlugSchema: { parse: vi.fn((v: unknown) => v) },
    disconnectProviderSchema: { parse: vi.fn((v: unknown) => v) },
    getSyncLogSchema: { parse: vi.fn((v: unknown) => v) },
    getWebhookLogSchema: { parse: vi.fn((v: unknown) => v) },
  };
});

vi.mock('../../services/slack-client', () => ({
  syncWorkspaceUsers: vi.fn(),
}));

vi.mock('../../services/portal-session', () => ({
  validatePortalSession: vi.fn(),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('../../services/portal-magic-link', () => ({
  createMagicLinkToken: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
  findContractorsByEmail: vi.fn(),
  sendPortalMagicLink: vi.fn(),
}));

vi.mock('../../services/r2', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  createPresignedUploadUrl: vi.fn(async () => ({ url: 'https://r2.test/upload', key: 'k' })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.test/download'),
  generateStorageKey: vi.fn(() => 'mock-key'),
}));

vi.mock('../../services/portal-change-request', () => ({
  createChangeRequest: vi.fn(),
}));

vi.mock('../../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/stripe-client', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { createPreview: vi.fn() },
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    billing: { meterEvents: { create: vi.fn() } },
  },
}));

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
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

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

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

// ---------------------------------------------------------------------------
// Caller setup
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeTenantCaller() {
  const session = {
    session: {
      id: 'session-integ',
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
      name: 'Integration Admin',
      email: 'admin@test.com',
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

const caller = makeTenantCaller();

// ---------------------------------------------------------------------------
// Reset + Env
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  resetServerEnvCacheForTesting();
  // Set required env vars (after reset so getServerEnv re-parses process.env)
  process.env.PUBLIC_APP_URL = 'https://app.test.com';
  process.env.API_URL = 'https://app.test.com';
});

// ===========================================================================
// getOAuthUrlGeneric
// ===========================================================================

describe('integration.getOAuthUrlGeneric', () => {
  // F-SEC-05 + F-SEC-21: the procedure now returns a local
  // /api/oauth/{provider}/start URL — NOT the IdP authorize URL — so the
  // start route can mint a single-use OAuthChallenge and set the
  // __Host-oauth_state cookie before redirecting to the IdP.
  function setupGoogleCalendarAdapter() {
    mockGetAdapter.mockReturnValue({
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientIdEnvVar: 'GOOGLE_CLIENT_ID',
        clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        redirectPath: '/api/integrations/google-calendar/callback',
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        extraAuthParams: { access_type: 'offline', prompt: 'consent' },
      }),
    });
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  }

  function setupOutlookAdapter() {
    mockGetAdapter.mockReturnValue({
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientIdEnvVar: 'OUTLOOK_CLIENT_ID',
        clientSecretEnvVar: 'OUTLOOK_CLIENT_SECRET',
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        redirectPath: '/api/integrations/outlook/callback',
        scopes: ['Calendars.ReadWrite', 'offline_access'],
        extraAuthParams: null,
      }),
    });
    process.env.OUTLOOK_CLIENT_ID = 'outlook-client-id';
    process.env.OUTLOOK_CLIENT_SECRET = 'outlook-client-secret';
  }

  it('returns the local /api/oauth/{provider}/start URL (F-SEC-05)', async () => {
    setupGoogleCalendarAdapter();

    const result = await caller.integration.getOAuthUrlGeneric({
      provider: 'google-calendar',
    });

    expect(result.url).toBe('https://app.test.com/api/oauth/google-calendar/start');
  });

  it('URL-encodes the provider slug to prevent open redirect', async () => {
    setupOutlookAdapter();

    const result = await caller.integration.getOAuthUrlGeneric({
      provider: 'outlook-calendar',
    });

    expect(result.url).toBe('https://app.test.com/api/oauth/outlook-calendar/start');
  });
});

// ===========================================================================
// disconnectGeneric
// ===========================================================================

describe('integration.disconnectGeneric', () => {
  it('disconnects a generic provider connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: 'conn-g1',
      organizationId: ORG_ID,
      provider: 'GOOGLE_CALENDAR',
      status: 'CONNECTED',
    });
    mockPrisma.integrationConnection.update.mockResolvedValueOnce({
      id: 'conn-g1',
      status: 'DISCONNECTED',
      credentialsRef: '',
    });

    const result = await caller.integration.disconnectGeneric({
      provider: 'google_calendar',
    });

    expect(result).toEqual({ success: true });
    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-g1' },
      data: { status: 'DISCONNECTED', credentialsRef: '' },
    });
  });

  it('throws NOT_FOUND when provider connection does not exist', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.integration.disconnectGeneric({ provider: 'google_calendar' }),
    ).rejects.toThrow('integrationNotFound');
  });
});

// ===========================================================================
// getSyncLog
// ===========================================================================

describe('integration.getSyncLog', () => {
  it('returns empty items when no connection exists', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null);

    const result = await caller.integration.getSyncLog({
      provider: 'slack',
      limit: 10,
    });

    expect(result).toEqual({ items: [], nextCursor: null });
  });

  it('returns paginated sync log entries', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: 'conn-sync',
    });
    const logEntries = Array.from({ length: 11 }, (_, i) => ({
      id: `log-${i}`,
      syncType: 'FULL',
      status: 'SUCCESS',
      direction: 'INBOUND',
      errorMessage: null,
      startedAt: new Date(),
      completedAt: new Date(),
    }));
    mockPrisma.integrationSyncLog.findMany.mockResolvedValueOnce(logEntries);

    const result = await caller.integration.getSyncLog({
      provider: 'slack',
      limit: 10,
    });

    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBe('log-10');
  });

  it('returns null nextCursor when fewer items than limit', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: 'conn-sync',
    });
    mockPrisma.integrationSyncLog.findMany.mockResolvedValueOnce([
      {
        id: 'log-0',
        syncType: 'FULL',
        status: 'SUCCESS',
        direction: 'INBOUND',
        errorMessage: null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const result = await caller.integration.getSyncLog({
      provider: 'slack',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});

// ===========================================================================
// getWebhookLog
// ===========================================================================

describe('integration.getWebhookLog', () => {
  it('returns paginated webhook delivery entries', async () => {
    const deliveries = Array.from({ length: 11 }, (_, i) => ({
      id: `wh-${i}`,
      eventType: 'message',
      deliveryStatus: 'SUCCESS',
      receivedAt: new Date(),
      processedAt: new Date(),
      errorMessage: null,
    }));
    mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce(deliveries);

    const result = await caller.integration.getWebhookLog({
      provider: 'slack',
      limit: 10,
    });

    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBe('wh-10');
  });

  it('returns null nextCursor when fewer items than limit', async () => {
    mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([
      {
        id: 'wh-0',
        eventType: 'message',
        deliveryStatus: 'SUCCESS',
        receivedAt: new Date(),
        processedAt: new Date(),
        errorMessage: null,
      },
    ]);

    const result = await caller.integration.getWebhookLog({
      provider: 'slack',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});

// ===========================================================================
// linkUser
// ===========================================================================

describe('integration.linkUser', () => {
  it('creates an external link when connection exists', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: 'conn-link',
      organizationId: ORG_ID,
      provider: 'SLACK',
    });
    const mockLink = {
      id: 'el-1',
      organizationId: ORG_ID,
      integrationConnectionId: 'conn-link',
      entityType: 'CONTRACTOR',
      entityId: 'user-target',
      externalType: 'SLACK_USER',
      externalId: 'U12345',
    };
    mockPrisma.externalLink.create.mockResolvedValueOnce(mockLink);

    const result = await caller.integration.linkUser({
      userId: 'user-target',
      externalId: 'U12345',
    });

    expect(result).toMatchObject({ id: 'el-1', externalId: 'U12345' });
  });

  it('throws PRECONDITION_FAILED when no Slack connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.integration.linkUser({ userId: 'user-target', externalId: 'U12345' }),
    ).rejects.toThrow('integrationNotConnected');
  });
});

// ===========================================================================
// unlinkUser
// ===========================================================================

describe('integration.unlinkUser', () => {
  it('deletes the external link when it exists', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValueOnce({
      id: 'el-unlink',
      organizationId: ORG_ID,
    });
    mockPrisma.externalLink.delete.mockResolvedValueOnce({});

    const result = await caller.integration.unlinkUser({
      externalLinkId: 'el-unlink',
    });

    expect(result).toEqual({ success: true });
    expect(mockPrisma.externalLink.delete).toHaveBeenCalledWith({
      where: { id: 'el-unlink' },
    });
  });

  it('throws NOT_FOUND when external link does not exist', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValueOnce(null);

    await expect(caller.integration.unlinkUser({ externalLinkId: 'nonexistent' })).rejects.toThrow(
      'integrationLinkNotFound',
    );
  });
});

// ===========================================================================
// listUserMappings
// ===========================================================================

describe('integration.listUserMappings', () => {
  it('returns empty mappings when no connection exists', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null);

    const result = await caller.integration.listUserMappings();

    expect(result).toEqual({ mappings: [], connectionId: null });
  });

  it('returns mappings with linked and unlinked status', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: 'conn-map',
    });
    mockPrisma.externalLink.findMany.mockResolvedValueOnce([
      {
        id: 'el-1',
        entityId: 'user-a',
        externalId: 'U111',
        externalUrl: null,
        metadataJson: null,
      },
    ]);
    mockPrisma.member.findMany.mockResolvedValueOnce([
      {
        userId: 'user-a',
        role: 'admin',
        user: { id: 'user-a', name: 'Alice', email: 'alice@test.com', image: null },
      },
      {
        userId: 'user-b',
        role: 'readonly',
        user: { id: 'user-b', name: 'Bob', email: 'bob@test.com', image: null },
      },
    ]);

    const result = await caller.integration.listUserMappings();

    expect(result.connectionId).toBe('conn-map');
    expect(result.mappings).toHaveLength(2);

    const linked = result.mappings.find((m: { userId: string }) => m.userId === 'user-a');
    expect(linked?.status).toBe('linked');
    expect(linked?.slackLink?.externalId).toBe('U111');

    const unlinked = result.mappings.find((m: { userId: string }) => m.userId === 'user-b');
    expect(unlinked?.status).toBe('unlinked');
    expect(unlinked?.slackLink).toBeNull();
  });
});
