/**
 * Docs router tests — attach / detach / list / search / refreshMetadata.
 * Mocks `doc-link-service` and `integrationConnection` lookup.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const TASK_RUN_ID = 'cltaskrun00000000000000001';
const EXTERNAL_LINK_ID = 'clexlink00000000000000001';
const CONNECTION_ID = 'clconnect0000000000000001';

const { mockPrisma, mockDocLink } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockDocLink = {
    attachDocLink: vi.fn(async () => ({ id: 'el-attach' })),
    detachDocLink: vi.fn(async () => undefined),
    getDocLinks: vi.fn(async () => [{ id: EXTERNAL_LINK_ID }]),
    searchDocs: vi.fn(async () => []),
    refreshDocMetadata: vi.fn(async () => ({ id: EXTERNAL_LINK_ID, title: 'Refreshed' })),
  };

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    $queryRaw: vi.fn(),
    notification: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    userNotificationPreference: {
      upsert: vi.fn(async (opts: { where: Rec; create: Rec }) => opts.create),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    integrationConnection: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    reminderRule: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Rec }) => ({ id: 'rule-new', ...data })),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ where, data }: { where: Rec; data: Rec }) => ({
        id: where.id,
        ...data,
      })),
      delete: vi.fn(async ({ where }: { where: Rec }) => ({ id: where.id })),
    },
    reminderInstance: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, mockDocLink };
});

vi.mock('../../services/doc-link-service', () => mockDocLink);

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
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../services/teams/teams-graph-client', () => ({
  getTeamsChannels: vi.fn(async () => []),
  getJoinedTeams: vi.fn(async () => []),
  getUserByEmail: vi.fn(async () => null),
}));

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async (_uid: string, _oid: string, type: string) => ({
    notificationType: type,
    channelEmail: true,
    channelSlack: false,
    channelInApp: true,
  })),
}));

vi.mock('../../services/r2', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  createPresignedUploadUrl: vi.fn(async () => ({
    url: 'https://r2.example.com/upload',
    key: 'mock-key',
  })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  generateStorageKey: vi.fn(() => 'mock-storage-key'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    orgSettings: (orgId: string) => `org-settings:${orgId}`,
    orgSettingsJson: (orgId: string, key: string) => `org-settings-json:${orgId}:${key}`,
    orgBranding: (orgId: string) => `org-branding:${orgId}`,
    settingsPrefix: (orgId: string) => `org-settings:${orgId}`,
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
  },
  CacheTTL: { ORG_SETTINGS: 300, ORG_SETTINGS_JSON: 300, ORG_BRANDING: 300, APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/approval-engine', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-event-service', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit.csv' })),
}));

vi.mock('../../services/billing-service', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
  getSubscription: vi.fn(async () => null),
  createCheckoutSession: vi.fn(async () => ({ url: 'https://stripe.test/checkout' })),
  createPortalSession: vi.fn(async () => ({})),
  getProrationPreview: vi.fn(async () => ({})),
  ensureStripeCustomer: vi.fn(async () => 'cus_mock'),
  createTopUpCheckoutSession: vi.fn(async () => ({})),
  updateSubscriptionSeatCount: vi.fn(async () => undefined),
}));

vi.mock('../../services/billing-constants', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set(['price_starter_monthly']),
  KNOWN_TOPUP_PRICE_IDS: new Set(['price_topup_10']),
}));

vi.mock('../../services/portal-change-request', () => ({
  approveChangeRequest: vi.fn(async () => undefined),
  rejectChangeRequest: vi.fn(async () => undefined),
}));

vi.mock('../../services/mime-validator', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
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

vi.mock('../../services/credit-service', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  getCreditBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
  checkAndDeductCredit: vi.fn(async () => true),
}));

vi.mock('../../services/ocr-extraction', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../services/billing-webhook', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../services/payment-export', () => ({
  generateCsv: vi.fn(async () => Buffer.from('csv-data')),
  generateElixir: vi.fn(() => Buffer.from('elixir-data')),
  generateSepaXml: vi.fn(() => Buffer.from('sepa-data')),
  resolveTransferTitle: vi.fn(() => 'FV/2025/001'),
}));

vi.mock('../../services/bank-statement', () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

const createCaller = createCallerFactory(appRouter);

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

const notionAttachInput = {
  workflowTaskRunId: TASK_RUN_ID,
  externalId: 'page-1',
  externalUrl: 'https://notion.so/page-1',
  externalType: 'NOTION_PAGE' as const,
  metadata: {
    title: 'Page',
    icon: null,
    lastEditedTime: '2026-04-01T00:00:00Z',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
});

describe('docs router', () => {
  it('attach throws PRECONDITION_FAILED when no connected Notion integration', async () => {
    await expect(caller.docs.attach(notionAttachInput)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    expect(mockDocLink.attachDocLink).not.toHaveBeenCalled();
  });

  it('attach delegates to attachDocLink when integration connection exists', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({ id: CONNECTION_ID });

    await caller.docs.attach(notionAttachInput);

    expect(mockPrisma.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        provider: 'NOTION',
        status: 'CONNECTED',
      },
      select: { id: true },
    });
    expect(mockDocLink.attachDocLink).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        organizationId: ORG_ID,
        integrationConnectionId: CONNECTION_ID,
        workflowTaskRunId: TASK_RUN_ID,
        externalType: 'NOTION_PAGE',
      }),
    );
  });

  it('detach calls detachDocLink with org scope', async () => {
    await caller.docs.detach({ externalLinkId: EXTERNAL_LINK_ID });

    expect(mockDocLink.detachDocLink).toHaveBeenCalledWith(mockPrisma, {
      organizationId: ORG_ID,
      externalLinkId: EXTERNAL_LINK_ID,
    });
  });

  it('list returns getDocLinks result', async () => {
    const rows = await caller.docs.list({ workflowTaskRunId: TASK_RUN_ID });

    expect(mockDocLink.getDocLinks).toHaveBeenCalledWith(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: TASK_RUN_ID,
    });
    expect(rows).toEqual([{ id: EXTERNAL_LINK_ID }]);
  });

  it('search forwards to searchDocs with prisma', async () => {
    mockDocLink.searchDocs.mockResolvedValueOnce([
      {
        id: 'n1',
        title: 'Doc',
        subtitle: 'Space',
        url: 'https://notion.so/x',
        provider: 'notion',
      },
    ]);

    const rows = await caller.docs.search({ query: 'tax' });

    expect(mockDocLink.searchDocs).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      query: 'tax',
      provider: 'all',
      prisma: mockPrisma,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provider).toBe('notion');
  });

  it('refreshMetadata delegates to refreshDocMetadata', async () => {
    const out = await caller.docs.refreshMetadata({ externalLinkId: EXTERNAL_LINK_ID });

    expect(mockDocLink.refreshDocMetadata).toHaveBeenCalledWith(
      mockPrisma,
      EXTERNAL_LINK_ID,
      ORG_ID,
    );
    expect(out).toEqual({ id: EXTERNAL_LINK_ID, title: 'Refreshed' });
  });
});
