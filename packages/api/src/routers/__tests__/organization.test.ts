/**
 * Organization router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/auth` to control Better Auth API responses.
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies delegation params, metadata merging, slug generation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';

// Shared with `auth.api` — organization router calls `authApi.*`.
const { orgAuthApi } = vi.hoisted(() => ({
  orgAuthApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(async () => ({
      id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      name: 'Test Org',
      slug: 'test-org',
      metadata: { countryCode: 'PL' },
      members: [],
    })),
    createOrganization: vi.fn(async () => ({
      id: 'new-org-id',
      name: 'New Org',
      slug: 'new-org',
    })),
    setActiveOrganization: vi.fn(async () => undefined),
    updateOrganization: vi.fn(async () => ({
      id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      name: 'Updated Org',
    })),
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
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: orgAuthApi },
  authApi: orgAuthApi,
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
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
});

// ===========================================================================
// Tests
// ===========================================================================

describe('organization.getCurrent', () => {
  it('queries auth API with the active organizationId from context', async () => {
    const mockOrg = {
      id: ORG_ID,
      name: 'My Company',
      slug: 'my-company',
      metadata: { countryCode: 'PL', defaultCurrency: 'PLN' },
      members: [{ id: 'm-1', role: 'owner' }],
    };
    vi.mocked(auth.api.getFullOrganization).mockResolvedValueOnce(mockOrg as never);

    const result = await caller.organization.getCurrent();

    expect(auth.api.getFullOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { organizationId: ORG_ID },
      }),
    );
    expect(result).toEqual(mockOrg);
  });
});

// NOTE — `organization.create` / `organization.update` tRPC procedures were
// removed in favour of Better Auth's `authClient.organization.*` (which the
// web client already calls directly). The corresponding test blocks have
// been deleted alongside the procedures; coverage for the Better Auth wiring
// belongs in the auth package, not in this tRPC router suite.

// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 + Phase 66 · Plan 02 — setKleinunternehmer DE-only gate
// ---------------------------------------------------------------------------
//
// Plan 57-04 Task 3 §6 manual scenario:
//   "In a DE org, navigate to Settings → Organization; find the Kleinunternehmer
//    toggle (should ONLY be visible for DE orgs). Enable the toggle ..."
//
// Phase 66 deterministic substitute: assert at the router layer that
//   (a) DE orgs can flip the flag and the persisted data carries it,
//   (b) non-DE orgs are rejected with FORBIDDEN before the persistence call
//       (UI hides the toggle for non-DE; the router enforces it as
//       defense-in-depth — Plan 57-04 Threat T-57-04-02).
//
// This block mocks the additional Prisma methods setKleinunternehmer needs
// (findUniqueOrThrow + update) inline via beforeEach so the changes do not
// pollute the hoisted mockPrisma factory.

describe('organization.setKleinunternehmer (Phase 57 · Plan 04 / Phase 66)', () => {
  const setKuFindUniqueOrThrow = vi.fn();
  const setKuUpdate = vi.fn();

  beforeEach(() => {
    setKuFindUniqueOrThrow.mockReset();
    setKuUpdate.mockReset();
    // Attach the additional methods that setKleinunternehmer requires.
    // The hoisted mockPrisma in this file only declares `organization.findUnique`
    // and `member.findFirst` because the original test surface is small.
    (mockPrisma.organization as Record<string, unknown>).findUniqueOrThrow = setKuFindUniqueOrThrow;
    (mockPrisma.organization as Record<string, unknown>).update = setKuUpdate;
  });

  it('flips isKleinunternehmer for a DE org and returns the new value', async () => {
    setKuFindUniqueOrThrow.mockResolvedValueOnce({ countryCode: 'DE' });
    setKuUpdate.mockResolvedValueOnce({ isKleinunternehmer: true });

    const result = await caller.organization.setKleinunternehmer({ enabled: true });

    expect(setKuFindUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORG_ID },
        select: { countryCode: true },
      }),
    );
    expect(setKuUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORG_ID },
        data: { isKleinunternehmer: true },
        select: { isKleinunternehmer: true },
      }),
    );
    expect(result).toEqual({ isKleinunternehmer: true });
  });

  it('throws FORBIDDEN for a non-DE org (UK) and does NOT call organization.update — defense-in-depth', async () => {
    setKuFindUniqueOrThrow.mockResolvedValueOnce({ countryCode: 'GB' });

    await expect(caller.organization.setKleinunternehmer({ enabled: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(setKuUpdate).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN for a non-DE org (PL) — covers the same gate from a non-EU-VAT-context-style country', async () => {
    setKuFindUniqueOrThrow.mockResolvedValueOnce({ countryCode: 'PL' });

    await expect(caller.organization.setKleinunternehmer({ enabled: false })).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );

    expect(setKuUpdate).not.toHaveBeenCalled();
  });
});
