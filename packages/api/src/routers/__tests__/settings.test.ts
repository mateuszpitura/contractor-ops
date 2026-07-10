/**
 * Settings router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, service modules, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies real logic: WHERE clauses, data transforms, merges.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const REQUEST_ID = 'clrequest000000000000001';

// Router calls `authApi.*`; tests assert on `auth.api.*` (same hoisted object).
const { settingsAuthApi } = vi.hoisted(() => ({
  settingsAuthApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(async () => ({
      id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      name: 'Test Org',
      slug: 'test-org',
      metadata: { legalName: 'Test Org LLC', fiscalYearStartMonth: 1 },
    })),
    updateOrganization: vi.fn(async () => ({ id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' })),
  },
}));

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-mock' })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    organization: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
    },
    contractorChangeRequest: {
      findMany: vi.fn(async () => []),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

/**
 * Queue the handler-side `organization.findUnique` result. The Phase-2 tenant
 * middleware no longer goes through `prisma.organization.findUnique` (it
 * reads through the mocked `org-cache` service), so only the handler call
 * needs to be queued.
 */
function orgFindUniqueAfterTenant(result: Record<string, unknown> | null) {
  mockPrisma.organization.findUnique.mockResolvedValueOnce(result);
}

// ---------------------------------------------------------------------------
// Mock service functions (hoisted)
// ---------------------------------------------------------------------------

const { mockApproveChangeRequest, mockRejectChangeRequest } = vi.hoisted(() => ({
  mockApproveChangeRequest: vi.fn(async () => undefined),
  mockRejectChangeRequest: vi.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: settingsAuthApi },
  authApi: settingsAuthApi,
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

// org-cache must report ACTIVE so tenant middleware does not throw orgSuspended.
vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async (orgId: string) => ({
    id: orgId,
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('../../services/portal-change-request', () => ({
  approveChangeRequest: mockApproveChangeRequest,
  rejectChangeRequest: mockRejectChangeRequest,
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

vi.mock('../../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/cache')>();
  const { createPassthroughCacheMock } = await import('../../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async () => ({})),
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

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
  // Re-set default permission mock
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
});

// ===========================================================================
// Tests
// ===========================================================================

describe('settings.get', () => {
  it('returns org settings scoped to the active organization', async () => {
    const mockOrg = {
      id: ORG_ID,
      name: 'Test Org',
      slug: 'test-org',
      metadata: { legalName: 'Test Org LLC', fiscalYearStartMonth: 4 },
    };
    vi.mocked(auth.api.getFullOrganization).mockResolvedValueOnce(mockOrg as never);

    const result = await caller.settings.get();

    expect(result).toEqual({
      id: ORG_ID,
      name: 'Test Org',
      slug: 'test-org',
      metadata: { legalName: 'Test Org LLC', fiscalYearStartMonth: 4 },
    });
    // Verify it queries with the correct organizationId
    expect(auth.api.getFullOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { organizationId: ORG_ID },
      }),
    );
  });
});

describe('settings.update', () => {
  it('passes metadata fields separately from name to auth API', async () => {
    vi.mocked(auth.api.updateOrganization).mockResolvedValueOnce({ id: ORG_ID } as never);

    await caller.settings.update({
      name: 'New Name',
      legalName: 'New Legal Name',
      fiscalYearStartMonth: 7,
    });

    expect(auth.api.updateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          organizationId: ORG_ID,
          data: {
            name: 'New Name',
            metadata: {
              legalName: 'New Legal Name',
              fiscalYearStartMonth: 7,
            },
          },
        },
      }),
    );
  });

  it('omits metadata key when no metadata fields provided', async () => {
    vi.mocked(auth.api.updateOrganization).mockResolvedValueOnce({ id: ORG_ID } as never);

    await caller.settings.update({ name: 'Only Name' });

    const call = vi.mocked(auth.api.updateOrganization).mock.calls[0]?.[0] as {
      body: { data: Record<string, unknown> };
    };
    expect(call.body.data.name).toBe('Only Name');
    expect(call.body.data.metadata).toBeUndefined();
  });
});

describe('settings.getExpiryReminderDefaults', () => {
  it('returns configured reminder days from settingsJson', async () => {
    orgFindUniqueAfterTenant({
      settingsJson: { contractExpiryReminderDaysBefore: [14, 30, 60] },
    });

    const result = await caller.settings.getExpiryReminderDefaults();

    expect(result).toEqual({ reminderDaysBefore: [14, 30, 60] });
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      select: { settingsJson: true },
    });
  });

  it('falls back to [30, 60, 90] when no settingsJson exists', async () => {
    orgFindUniqueAfterTenant(null);

    const result = await caller.settings.getExpiryReminderDefaults();

    expect(result).toEqual({ reminderDaysBefore: [30, 60, 90] });
  });
});

describe('settings.updateExpiryReminderDefaults', () => {
  it('merges new reminderDaysBefore into existing settingsJson', async () => {
    orgFindUniqueAfterTenant({
      settingsJson: { brandColor: '#FF0000', contractExpiryReminderDaysBefore: [30, 60, 90] },
    });

    await caller.settings.updateExpiryReminderDefaults({
      reminderDaysBefore: [7, 14],
    });

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: {
        settingsJson: {
          brandColor: '#FF0000',
          contractExpiryReminderDaysBefore: [7, 14],
        },
      },
    });
  });
});

describe('settings.getBranding', () => {
  it('returns brandColor from settingsJson and logo from org', async () => {
    orgFindUniqueAfterTenant({
      logo: 'https://cdn.example.com/logo.png',
      settingsJson: { brandColor: '#3366FF' },
    });

    const result = await caller.settings.getBranding();

    expect(result).toEqual({
      brandColor: '#3366FF',
      logo: 'https://cdn.example.com/logo.png',
    });
  });

  it('returns null for brandColor when not set in settingsJson', async () => {
    orgFindUniqueAfterTenant({
      logo: null,
      settingsJson: {},
    });

    const result = await caller.settings.getBranding();

    expect(result).toEqual({ brandColor: null, logo: null });
  });
});

describe('settings.updateBranding', () => {
  it('merges brandColor into existing settingsJson without replacing other keys', async () => {
    orgFindUniqueAfterTenant({
      settingsJson: { existingKey: 'keep-me', brandColor: '#000000' },
      logo: 'old-logo.png',
    });

    const result = await caller.settings.updateBranding({
      brandColor: '#FF5500',
    });

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: {
        settingsJson: {
          existingKey: 'keep-me',
          brandColor: '#FF5500',
        },
      },
    });
    expect(result.brandColor).toBe('#FF5500');
  });

  it('removes brandColor from settingsJson when set to null', async () => {
    orgFindUniqueAfterTenant({
      settingsJson: { brandColor: '#123456', other: 'value' },
      logo: null,
    });

    const result = await caller.settings.updateBranding({
      brandColor: null,
    });

    // brandColor should be deleted from settingsJson
    const updateCall = mockPrisma.organization.update.mock.calls[0][0];
    expect(updateCall.data.settingsJson).toEqual({ other: 'value' });
    expect(result.brandColor).toBeNull();
  });
});

describe('settings.getPortalDomain', () => {
  it('returns slug, portalSubdomain, and portalCustomDomain', async () => {
    orgFindUniqueAfterTenant({
      slug: 'test-org',
      portalSubdomain: 'my-portal',
      portalCustomDomain: 'portal.example.com',
    });

    const result = await caller.settings.getPortalDomain();

    expect(result).toEqual({
      slug: 'test-org',
      portalSubdomain: 'my-portal',
      portalCustomDomain: 'portal.example.com',
    });
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      select: { slug: true, portalSubdomain: true, portalCustomDomain: true },
    });
  });
});

describe('settings.updatePortalDomain', () => {
  it('checks uniqueness excluding current org before updating', async () => {
    mockPrisma.organization.findFirst.mockResolvedValueOnce(null); // no conflict

    await caller.settings.updatePortalDomain({
      portalSubdomain: 'my-portal',
    });

    // Verify uniqueness check excludes current org
    expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
      where: {
        portalSubdomain: 'my-portal',
        id: { not: ORG_ID },
      },
    });
    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { portalSubdomain: 'my-portal' },
    });
  });

  it('throws CONFLICT when subdomain is already taken by another org', async () => {
    mockPrisma.organization.findFirst.mockResolvedValueOnce({ id: 'other-org' });

    await expect(
      caller.settings.updatePortalDomain({ portalSubdomain: 'taken-name' }),
    ).rejects.toThrow(TRPCError);

    // Should NOT have called update
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it('sets portalSubdomain to null when input is null', async () => {
    await caller.settings.updatePortalDomain({ portalSubdomain: null });

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { portalSubdomain: null },
    });
    // No uniqueness check for null
    expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
  });
});

describe('settings.listChangeRequests', () => {
  it('filters by status and scopes to organization', async () => {
    mockPrisma.contractorChangeRequest.findMany.mockResolvedValueOnce([
      {
        id: REQUEST_ID,
        contractorId: 'c-1',
        contractor: { displayName: 'John', email: 'john@example.com' },
        status: 'PENDING',
        requestedChanges: { address: 'new' },
        previousValues: { address: 'old' },
        reviewedBy: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: new Date('2025-01-01'),
      },
    ]);

    const result = await caller.settings.listChangeRequests({ status: 'PENDING' });

    expect(mockPrisma.contractorChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result[0]?.contractorName).toBe('John');
    expect(result[0]?.contractorEmail).toBe('john@example.com');
  });
});

describe('settings.reviewChangeRequest', () => {
  it('delegates to approveChangeRequest with correct params', async () => {
    await caller.settings.reviewChangeRequest({
      requestId: REQUEST_ID,
      action: 'approve',
      comment: 'Looks good',
    });

    expect(mockApproveChangeRequest).toHaveBeenCalledWith(
      REQUEST_ID,
      ORG_ID,
      USER_ID,
      'Looks good',
    );
    expect(mockRejectChangeRequest).not.toHaveBeenCalled();
  });

  it('delegates to rejectChangeRequest for reject action', async () => {
    await caller.settings.reviewChangeRequest({
      requestId: REQUEST_ID,
      action: 'reject',
      comment: 'Incomplete',
    });

    expect(mockRejectChangeRequest).toHaveBeenCalledWith(REQUEST_ID, ORG_ID, USER_ID, 'Incomplete');
    expect(mockApproveChangeRequest).not.toHaveBeenCalled();
  });
});
