/**
 * User router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth` to control Better Auth API responses.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies real logic: member flattening, last-admin guard, approval reassignment.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const TARGET_USER_ID = 'cltarget0000000000000001';
const MEMBER_ID = 'clmember0000000000000001';

// Shared auth API mocks: `user` router calls `authApi.*`; tests assert on `auth.api.*`.
// (String literals inside hoisted — `vi.hoisted` runs before module `const` initializers.)
const { userAuthApi } = vi.hoisted(() => {
  const getFullOrganization = vi.fn(async () => ({
    id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
    members: [] as unknown[],
  }));
  const createInvitation = vi.fn(async () => ({ id: 'inv-1' }));
  const updateMemberRole = vi.fn(async () => ({ id: 'clmember0000000000000001' }));
  const banUser = vi.fn(async () => ({
    user: { id: 'cltarget0000000000000001', banned: true },
  }));
  const unbanUser = vi.fn(async () => ({
    user: { id: 'cltarget0000000000000001', banned: false },
  }));
  return {
    userAuthApi: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
      getFullOrganization,
      createInvitation,
      updateMemberRole,
      banUser,
      unbanUser,
    },
  };
});

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
      count: vi.fn(async () => 2),
    },
    approvalStep: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    contractor: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: userAuthApi },
  authApi: userAuthApi,
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
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

vi.mock('../../services/r2.js', () => ({
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

vi.mock('../../services/cache.js', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {},
  CacheTTL: {},
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

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async () => ({})),
}));

vi.mock('../../services/invoice-matching.js', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/approval-engine.js', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-event-service.js', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync.js', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export.js', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit.csv' })),
}));

vi.mock('../../services/billing-service.js', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
  getSubscription: vi.fn(async () => null),
  createCheckoutSession: vi.fn(async () => ({})),
  createPortalSession: vi.fn(async () => ({})),
  getProrationPreview: vi.fn(async () => ({})),
  ensureStripeCustomer: vi.fn(async () => 'cus_mock'),
  createTopUpCheckoutSession: vi.fn(async () => ({})),
  updateSubscriptionSeatCount: vi.fn(async () => undefined),
}));

vi.mock('../../services/billing-constants.js', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set(['price_starter_monthly']),
  KNOWN_TOPUP_PRICE_IDS: new Set(['price_topup_10']),
}));

vi.mock('../../services/portal-change-request.js', () => ({
  approveChangeRequest: vi.fn(async () => undefined),
  rejectChangeRequest: vi.fn(async () => undefined),
}));

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/credit-service.js', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  getCreditBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
  checkAndDeductCredit: vi.fn(async () => true),
}));

vi.mock('../../services/ocr-extraction.js', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../services/billing-webhook.js', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../services/payment-export.js', () => ({
  generateCsv: vi.fn(async () => Buffer.from('csv-data')),
  generateElixir: vi.fn(() => Buffer.from('elixir-data')),
  generateSepaXml: vi.fn(() => Buffer.from('sepa-data')),
  resolveTransferTitle: vi.fn(() => 'FV/2025/001'),
}));

vi.mock('../../services/bank-statement.js', () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeCaller(userId: string, orgId: string) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(), // fresh session for sensitive actions
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
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
  // Default: target is admin, 2 admins in org
  mockPrisma.member.findFirst.mockResolvedValue({ role: 'admin' });
  mockPrisma.member.count.mockResolvedValue(2);
});

// ===========================================================================
// Tests
// ===========================================================================

describe('user.list', () => {
  it('flattens nested member.user into a flat shape', async () => {
    vi.mocked(auth.api.getFullOrganization).mockResolvedValueOnce({
      id: ORG_ID,
      members: [
        {
          id: MEMBER_ID,
          userId: TARGET_USER_ID,
          role: 'readonly',
          createdAt: '2025-01-01T00:00:00Z',
          user: {
            id: TARGET_USER_ID,
            name: 'Jane Doe',
            email: 'jane@example.com',
            image: 'https://avatar.example.com/jane.png',
          },
        },
      ],
    } as never);

    const result = await caller.user.list();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: MEMBER_ID,
      userId: TARGET_USER_ID,
      name: 'Jane Doe',
      email: 'jane@example.com',
      image: 'https://avatar.example.com/jane.png',
      role: 'readonly',
      createdAt: '2025-01-01T00:00:00Z',
    });
  });

  it('queries with the correct organizationId', async () => {
    vi.mocked(auth.api.getFullOrganization).mockResolvedValueOnce({
      id: ORG_ID,
      members: [],
    } as never);

    await caller.user.list();

    expect(auth.api.getFullOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { organizationId: ORG_ID },
      }),
    );
  });
});

describe('user.invite', () => {
  it('calls auth createInvitation with correct org and role', async () => {
    await caller.user.invite({ email: 'new@example.com', role: 'admin' });

    expect(auth.api.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: 'new@example.com',
          role: 'admin',
          organizationId: ORG_ID,
        },
      }),
    );
  });
});

describe('user.updateRole', () => {
  it('calls auth updateMemberRole with memberId and new role', async () => {
    await caller.user.updateRole({ userId: MEMBER_ID, role: 'admin' });

    expect(auth.api.updateMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          memberId: MEMBER_ID,
          role: 'admin',
          organizationId: ORG_ID,
        },
      }),
    );
  });
});

describe('user.deactivate', () => {
  it('prevents deactivating the last admin', async () => {
    mockPrisma.member.findFirst.mockResolvedValueOnce({ role: 'admin' });
    mockPrisma.member.count.mockResolvedValueOnce(1); // only 1 admin

    await expect(caller.user.deactivate({ userId: TARGET_USER_ID })).rejects.toThrow(
      'LAST_ADMIN_CANNOT_DEACTIVATE',
    );

    expect(auth.api.banUser).not.toHaveBeenCalled();
  });

  it('reassigns pending approval steps to another user with same role', async () => {
    const pendingStep = {
      id: 'step-1',
      approverRole: 'admin',
    };
    mockPrisma.member.findFirst
      .mockResolvedValueOnce({ role: 'admin' }) // target member lookup
      .mockResolvedValueOnce({ userId: 'replacement-user' }); // replacement lookup
    mockPrisma.member.count.mockResolvedValueOnce(2);
    mockPrisma.approvalStep.findMany.mockResolvedValueOnce([pendingStep]);
    mockPrisma.contractor.findMany.mockResolvedValueOnce([]);

    await caller.user.deactivate({ userId: TARGET_USER_ID });

    // Verify approval step query scopes to org + user + pending statuses
    expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        approverUserId: TARGET_USER_ID,
        status: { in: ['NOT_STARTED', 'PENDING'] },
      },
      select: { id: true, approverRole: true },
    });

    // Verify reassignment
    expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
      where: { id: 'step-1' },
      data: { approverUserId: 'replacement-user' },
    });
  });

  it('transfers contractor ownership to an admin when deactivating', async () => {
    mockPrisma.member.findFirst
      .mockResolvedValueOnce({ role: 'readonly' }) // target is not admin
      .mockResolvedValueOnce({ userId: USER_ID }); // replacement admin
    mockPrisma.approvalStep.findMany.mockResolvedValueOnce([]);
    mockPrisma.contractor.findMany.mockResolvedValueOnce([
      { id: 'contractor-1' },
      { id: 'contractor-2' },
    ]);

    await caller.user.deactivate({ userId: TARGET_USER_ID });

    expect(mockPrisma.contractor.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['contractor-1', 'contractor-2'] } },
      data: { ownerUserId: USER_ID },
    });
  });
});

describe('user.reactivate', () => {
  it('calls auth unbanUser with correct userId', async () => {
    await caller.user.reactivate({ userId: TARGET_USER_ID });

    expect(auth.api.unbanUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userId: TARGET_USER_ID },
      }),
    );
  });
});
