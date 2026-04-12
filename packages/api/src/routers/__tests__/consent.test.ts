/**
 * Consent router unit tests.
 *
 * Strategy: Mock services at module level, verify router delegates correctly
 * to consent-record and privacy-notice services.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-consent-test-001';
const USER_ID = 'user-consent-test-001';

// ---------------------------------------------------------------------------
// Service mocks (vi.hoisted)
// ---------------------------------------------------------------------------

const {
  mockGrantConsent,
  mockRevokeConsent,
  mockGetCurrentConsent,
  mockGetConsentHistory,
  mockHasRequiredConsents,
  mockBulkGrantConsent,
  mockGetPrivacyNotice,
  mockOrgFindUniqueOrThrow,
} = vi.hoisted(() => ({
  mockGrantConsent: vi.fn(),
  mockRevokeConsent: vi.fn(),
  mockGetCurrentConsent: vi.fn(),
  mockGetConsentHistory: vi.fn(),
  mockHasRequiredConsents: vi.fn(),
  mockBulkGrantConsent: vi.fn(),
  mockGetPrivacyNotice: vi.fn(),
  mockOrgFindUniqueOrThrow: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    organization: {
      findUniqueOrThrow: mockOrgFindUniqueOrThrow,
    },
  },
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(),
  createTenantClientFrom: vi.fn(),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}));

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('../../services/consent-record.js', () => ({
  grantConsent: mockGrantConsent,
  revokeConsent: mockRevokeConsent,
  getCurrentConsent: mockGetCurrentConsent,
  getConsentHistory: mockGetConsentHistory,
  hasRequiredConsents: mockHasRequiredConsents,
  bulkGrantConsent: mockBulkGrantConsent,
}));

vi.mock('../../services/privacy-notice.js', () => ({
  getPrivacyNotice: mockGetPrivacyNotice,
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

vi.mock('../../services/billing-service.js', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
  getSubscription: vi.fn(async () => ({
    id: 'sub_mock',
    status: 'ACTIVE',
    tier: 'STARTER',
  })),
}));

vi.mock('../../services/billing-webhook.js', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../services/r2.js', () => ({
  createPresignedUploadUrl: vi.fn(async () => ({
    url: 'https://r2.example.com/upload',
    key: 'mock-key',
  })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  generateStorageKey: vi.fn(() => 'mock-storage-key'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
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

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/credit-service.js', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock('../../services/report-export.js', () => ({
  generateAuditCsv: vi.fn(async () => ({
    data: 'bW9ja0NTVg==',
    mimeType: 'text/csv;charset=utf-8',
  })),
}));

vi.mock('../../services/ocr-extraction.js', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

// ---------------------------------------------------------------------------
// Import router + create caller
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

const createCallerFromFactory = createCallerFactory(appRouter);

function createCaller() {
  const session = {
    session: {
      id: `session-${USER_ID}`,
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
      name: 'Test User',
      email: 'test@example.com',
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
  return createCallerFromFactory({
    headers: new Headers({
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'test-browser',
    }),
    session: session as never,
    user: session.user as never,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockOrgFindUniqueOrThrow.mockResolvedValue({
    name: 'Test Corp',
    countryCode: 'AE',
  });
});

describe('consentRouter', () => {
  describe('getPrivacyNotice', () => {
    it('returns null for org without countryCode', async () => {
      mockOrgFindUniqueOrThrow.mockResolvedValue({ countryCode: null });

      const caller = createCaller();
      const result = await caller.consent.getPrivacyNotice();

      expect(result).toBeNull();
      expect(mockGetPrivacyNotice).not.toHaveBeenCalled();
    });

    it('returns privacy notice for AE org', async () => {
      const mockNotice = {
        jurisdiction: 'AE',
        legalReference: 'Federal Decree-Law No. 45/2021',
        controller: { name: 'Test Corp', country: 'AE' },
        sections: [],
      };
      mockGetPrivacyNotice.mockResolvedValue(mockNotice);

      const caller = createCaller();
      const result = await caller.consent.getPrivacyNotice();

      expect(result).toEqual(mockNotice);
      expect(mockGetPrivacyNotice).toHaveBeenCalledWith(ORG_ID, 'AE');
    });
  });

  describe('getCurrentConsent', () => {
    it('returns empty object for new user', async () => {
      mockGetCurrentConsent.mockResolvedValue(new Map());

      const caller = createCaller();
      const result = await caller.consent.getCurrentConsent();

      expect(result).toEqual({});
    });

    it('returns consent state as plain object', async () => {
      const consentMap = new Map([
        [
          'CONTRACTOR_DATA_PROCESSING',
          {
            purpose: 'CONTRACTOR_DATA_PROCESSING',
            granted: true,
            version: 1,
            lastUpdated: new Date(),
          },
        ],
      ]);
      mockGetCurrentConsent.mockResolvedValue(consentMap);

      const caller = createCaller();
      const result = await caller.consent.getCurrentConsent();

      expect(result).toHaveProperty('CONTRACTOR_DATA_PROCESSING');
      expect(result.CONTRACTOR_DATA_PROCESSING.granted).toBe(true);
    });
  });

  describe('grant', () => {
    it('calls grantConsent for granted=true', async () => {
      mockGrantConsent.mockResolvedValue({ id: 'cr_1', version: 1 });

      const caller = createCaller();
      const result = await caller.consent.grant({
        purpose: 'CONTRACTOR_DATA_PROCESSING',
        granted: true,
      });

      expect(result).toEqual({ id: 'cr_1', version: 1 });
      expect(mockGrantConsent).toHaveBeenCalledWith(
        ORG_ID,
        USER_ID,
        'CONTRACTOR_DATA_PROCESSING',
        '192.168.1.1',
        'test-browser',
      );
    });

    it('calls revokeConsent for granted=false', async () => {
      mockRevokeConsent.mockResolvedValue({ id: 'cr_2', version: 2 });

      const caller = createCaller();
      const result = await caller.consent.grant({
        purpose: 'ANALYTICS_REPORTING',
        granted: false,
      });

      expect(result).toEqual({ id: 'cr_2', version: 2 });
      expect(mockRevokeConsent).toHaveBeenCalledWith(
        ORG_ID,
        USER_ID,
        'ANALYTICS_REPORTING',
        '192.168.1.1',
        'test-browser',
      );
    });
  });

  describe('bulkGrant', () => {
    it('delegates to bulkGrantConsent service', async () => {
      const mockResults = [
        {
          id: 'cr_1',
          purpose: 'CONTRACTOR_DATA_PROCESSING',
          granted: true,
          version: 1,
        },
        {
          id: 'cr_2',
          purpose: 'INVOICE_PAYMENT_PROCESSING',
          granted: true,
          version: 1,
        },
      ];
      mockBulkGrantConsent.mockResolvedValue(mockResults);

      const caller = createCaller();
      const result = await caller.consent.bulkGrant({
        consents: [
          { purpose: 'CONTRACTOR_DATA_PROCESSING', granted: true },
          { purpose: 'INVOICE_PAYMENT_PROCESSING', granted: true },
        ],
      });

      expect(result).toHaveLength(2);
      expect(mockBulkGrantConsent).toHaveBeenCalledWith(
        ORG_ID,
        USER_ID,
        [
          { purpose: 'CONTRACTOR_DATA_PROCESSING', granted: true },
          { purpose: 'INVOICE_PAYMENT_PROCESSING', granted: true },
        ],
        '192.168.1.1',
        'test-browser',
      );
    });
  });

  describe('hasRequiredConsents', () => {
    it('returns false when missing required consents', async () => {
      mockHasRequiredConsents.mockResolvedValue(false);

      const caller = createCaller();
      const result = await caller.consent.hasRequiredConsents();

      expect(result).toBe(false);
    });

    it('returns true when all required consents granted', async () => {
      mockHasRequiredConsents.mockResolvedValue(true);

      const caller = createCaller();
      const result = await caller.consent.hasRequiredConsents();

      expect(result).toBe(true);
    });
  });

  describe('adminGetUserConsent', () => {
    it('delegates to getCurrentConsent with target userId', async () => {
      const consentMap = new Map([
        [
          'ANALYTICS_REPORTING',
          {
            purpose: 'ANALYTICS_REPORTING',
            granted: true,
            version: 1,
            lastUpdated: new Date(),
          },
        ],
      ]);
      mockGetCurrentConsent.mockResolvedValue(consentMap);

      const caller = createCaller();
      const result = await caller.consent.adminGetUserConsent({
        userId: 'target-user-123',
      });

      expect(mockGetCurrentConsent).toHaveBeenCalledWith(ORG_ID, 'target-user-123');
      expect(result).toHaveProperty('ANALYTICS_REPORTING');
    });
  });
});
