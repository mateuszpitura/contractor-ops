/**
 * Portal notification preferences router tests.
 *
 * Tests getNotificationPreferences and updateNotificationPreference procedures.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-notif-001';
const CONTRACTOR_ID = 'contractor-notif-001';
const SESSION_TOKEN = 'portal-session-token-notif';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    contractorNotificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    contractor: {
      findUnique: vi.fn(),
    },
    contractorBillingProfile: {
      findFirst: vi.fn(),
    },
    contractorChangeRequest: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
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

vi.mock('../../services/portal-session.js', () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      contractor: { id: CONTRACTOR_ID, email: 'contractor@test.com' },
    };
  }),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('../../services/portal-magic-link.js', () => ({
  createMagicLinkToken: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
  findContractorsByEmail: vi.fn(),
  sendPortalMagicLink: vi.fn(),
}));

vi.mock('../../services/r2.js', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  createPresignedUploadUrl: vi.fn(async () => ({ url: 'https://r2.test/upload', key: 'k' })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.test/download'),
  generateStorageKey: vi.fn(() => 'mock-key'),
}));

vi.mock('../../services/portal-change-request.js', () => ({
  createChangeRequest: vi.fn(),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/stripe-client.js', () => ({
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { portalAppRouter } from '../../portal-root.js';

// ---------------------------------------------------------------------------
// Caller setup
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(portalAppRouter);

function makePortalCaller() {
  return createCaller({
    headers: new Headers({ cookie: `portal_session=${SESSION_TOKEN}` }),
    session: null as never,
    user: null as never,
  });
}

const caller = makePortalCaller();

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// getNotificationPreferences
// ===========================================================================

describe('portal.getNotificationPreferences', () => {
  it('returns all 5 categories with emailEnabled defaults for missing rows (PORT-07a)', async () => {
    // No rows exist — all should default to true
    mockPrisma.contractorNotificationPreference.findMany.mockResolvedValue([]);

    const result = await caller.portal.getNotificationPreferences();

    expect(result).toHaveLength(5);
    for (const pref of result) {
      expect(pref.emailEnabled).toBe(true);
    }
  });

  it('returns actual emailEnabled values for existing preference rows', async () => {
    mockPrisma.contractorNotificationPreference.findMany.mockResolvedValue([
      { category: 'INVOICE_UPDATES', emailEnabled: false },
      { category: 'PAYMENT_CONFIRMATIONS', emailEnabled: true },
    ]);

    const result = await caller.portal.getNotificationPreferences();

    expect(result).toHaveLength(5);
    const invoiceUpdates = result.find(p => p.category === 'INVOICE_UPDATES');
    expect(invoiceUpdates?.emailEnabled).toBe(false);
    const paymentConf = result.find(p => p.category === 'PAYMENT_CONFIRMATIONS');
    expect(paymentConf?.emailEnabled).toBe(true);
    // Missing rows default to true
    const contractChanges = result.find(p => p.category === 'CONTRACT_CHANGES');
    expect(contractChanges?.emailEnabled).toBe(true);
  });

  it('categories are: INVOICE_UPDATES, PAYMENT_CONFIRMATIONS, CONTRACT_CHANGES, DOCUMENT_UPLOADS, SECURITY_ALERTS', async () => {
    mockPrisma.contractorNotificationPreference.findMany.mockResolvedValue([]);

    const result = await caller.portal.getNotificationPreferences();

    const categories = result.map(p => p.category);
    expect(categories).toEqual([
      'INVOICE_UPDATES',
      'PAYMENT_CONFIRMATIONS',
      'CONTRACT_CHANGES',
      'DOCUMENT_UPLOADS',
      'SECURITY_ALERTS',
    ]);
  });
});

// ===========================================================================
// updateNotificationPreference
// ===========================================================================

describe('portal.updateNotificationPreference', () => {
  it('upserts preference for a valid category (PORT-07b)', async () => {
    mockPrisma.contractorNotificationPreference.upsert.mockResolvedValue({
      category: 'INVOICE_UPDATES',
      emailEnabled: false,
    });

    const result = await caller.portal.updateNotificationPreference({
      category: 'INVOICE_UPDATES',
      emailEnabled: false,
    });

    expect(result.category).toBe('INVOICE_UPDATES');
    expect(result.emailEnabled).toBe(false);

    // Verify the upsert uses the correct composite key
    const upsertCall = mockPrisma.contractorNotificationPreference.upsert.mock.calls[0][0];
    expect(upsertCall.where).toMatchObject({
      contractorId_category: {
        contractorId: CONTRACTOR_ID,
        category: 'INVOICE_UPDATES',
      },
    });
  });

  it('creates new preference row when none exists for category', async () => {
    mockPrisma.contractorNotificationPreference.upsert.mockResolvedValue({
      category: 'DOCUMENT_UPLOADS',
      emailEnabled: false,
    });

    await caller.portal.updateNotificationPreference({
      category: 'DOCUMENT_UPLOADS',
      emailEnabled: false,
    });

    const upsertCall = mockPrisma.contractorNotificationPreference.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      category: 'DOCUMENT_UPLOADS',
      emailEnabled: false,
    });
  });

  it('updates existing preference row when one exists', async () => {
    mockPrisma.contractorNotificationPreference.upsert.mockResolvedValue({
      category: 'CONTRACT_CHANGES',
      emailEnabled: true,
    });

    await caller.portal.updateNotificationPreference({
      category: 'CONTRACT_CHANGES',
      emailEnabled: true,
    });

    const upsertCall = mockPrisma.contractorNotificationPreference.upsert.mock.calls[0][0];
    expect(upsertCall.update).toMatchObject({
      emailEnabled: true,
    });
  });

  it('throws BAD_REQUEST when attempting to disable SECURITY_ALERTS (PORT-07c)', async () => {
    await expect(
      caller.portal.updateNotificationPreference({
        category: 'SECURITY_ALERTS',
        emailEnabled: false,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('allows enabling SECURITY_ALERTS (no-op but valid)', async () => {
    mockPrisma.contractorNotificationPreference.upsert.mockResolvedValue({
      category: 'SECURITY_ALERTS',
      emailEnabled: true,
    });

    const result = await caller.portal.updateNotificationPreference({
      category: 'SECURITY_ALERTS',
      emailEnabled: true,
    });

    expect(result.emailEnabled).toBe(true);
  });

  it('validates category is one of the 5 allowed enum values', async () => {
    await expect(
      caller.portal.updateNotificationPreference({
        category: 'INVALID_CATEGORY' as never,
        emailEnabled: false,
      }),
    ).rejects.toThrow();
  });
});
