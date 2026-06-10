/**
 * Reminder router tests — list / create / update / delete / toggleActive.
 * Same app-level mocks as `search.test.ts` so `appRouter` loads.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const RULE_ID = 'clreminder0000000000000001';

const { mockPrisma } = vi.hoisted(() => {
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

  return { mockPrisma };
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
  createCheckoutSession: vi.fn(async () => ({})),
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
  createLogger: vi.fn(() => ({ info: vi.fn(),
 warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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

beforeEach(() => {
  vi.clearAllMocks();
});

const baseCreateInput = {
  name: 'Invoice due reminder',
  entityType: 'INVOICE' as const,
  triggerType: 'BEFORE_DUE_DATE' as const,
  offsetDays: 3,
  channel: 'EMAIL' as const,
  recipientMode: 'FINANCE_TEAM' as const,
  active: true,
};

describe('reminder router', () => {
  it('list scopes rules to organization and sorts by createdAt desc', async () => {
    mockPrisma.reminderRule.findMany.mockResolvedValueOnce([{ id: RULE_ID, name: 'A' }]);

    const rows = await caller.reminder.list();

    expect(mockPrisma.reminderRule.findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows).toEqual([{ id: RULE_ID, name: 'A' }]);
  });

  it('create persists organizationId and rule fields', async () => {
    await caller.reminder.create(baseCreateInput);

    expect(mockPrisma.reminderRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        name: baseCreateInput.name,
        entityType: baseCreateInput.entityType,
        triggerType: baseCreateInput.triggerType,
        offsetDays: 3,
        channel: baseCreateInput.channel,
        recipientMode: baseCreateInput.recipientMode,
        active: true,
      }),
    });
  });

  it('update throws NOT_FOUND when rule is missing in org', async () => {
    mockPrisma.reminderRule.findFirst.mockResolvedValueOnce(null);

    await expect(caller.reminder.update({ id: RULE_ID, name: 'Renamed' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mockPrisma.reminderRule.update).not.toHaveBeenCalled();
  });

  it('update applies changes when rule exists in org', async () => {
    mockPrisma.reminderRule.findFirst.mockResolvedValueOnce({
      id: RULE_ID,
      organizationId: ORG_ID,
    });

    await caller.reminder.update({ id: RULE_ID, name: 'Renamed' });

    expect(mockPrisma.reminderRule.update).toHaveBeenCalledWith({
      where: { id: RULE_ID },
      data: expect.objectContaining({ name: 'Renamed' }),
    });
  });

  it('delete runs transaction: instances then rule', async () => {
    mockPrisma.reminderRule.findFirst.mockResolvedValueOnce({
      id: RULE_ID,
      organizationId: ORG_ID,
    });

    await caller.reminder.delete({ id: RULE_ID });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.reminderInstance.deleteMany).toHaveBeenCalledWith({
      where: {
        reminderRuleId: RULE_ID,
        organizationId: ORG_ID,
      },
    });
    expect(mockPrisma.reminderRule.delete).toHaveBeenCalledWith({
      where: { id: RULE_ID },
    });
  });

  it('toggleActive false cancels pending instances', async () => {
    mockPrisma.reminderRule.findFirst.mockResolvedValueOnce({
      id: RULE_ID,
      organizationId: ORG_ID,
    });

    await caller.reminder.toggleActive({ id: RULE_ID, active: false });

    expect(mockPrisma.reminderRule.update).toHaveBeenCalledWith({
      where: { id: RULE_ID },
      data: { active: false },
    });
    expect(mockPrisma.reminderInstance.updateMany).toHaveBeenCalledWith({
      where: {
        reminderRuleId: RULE_ID,
        organizationId: ORG_ID,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });
  });
});
