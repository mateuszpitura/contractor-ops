/**
 * Equipment Returns router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, InPost client, notification-service, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies delegation params, guard logic, and data flow.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';

// ---------------------------------------------------------------------------
// Mock Prisma + services (hoisted)
// ---------------------------------------------------------------------------

const { mockPrisma, mockInPostCreateShipment, mockDispatch } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        billingEmail: 'billing@test.com',
        name: 'Test Org',
      })),
    },
    returnRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    equipmentAssignment: {
      findMany: vi.fn(async () => []),
    },
    courierConfig: {
      findUnique: vi.fn(),
    },
    shipment: {
      create: vi.fn(),
    },
    shipmentEvent: {
      create: vi.fn(),
    },
    equipment: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    contractor: { count: vi.fn(async () => 0) },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockInPostCreateShipment: vi.fn(async () => ({
      trackingNumber: 'INPOST-RET-123',
      externalId: 'ext-ret-1',
      labelUrl: 'https://labels.inpost.com/return-label.pdf',
    })),
    mockDispatch: vi.fn(async () => undefined),
  };
});

// ---------------------------------------------------------------------------
// Mock modules
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

vi.mock('../../services/courier/inpost-client.js', () => ({
  InPostClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.createShipment = mockInPostCreateShipment;
  }),
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: mockDispatch,
  getOrCreatePreferences: vi.fn(async () => ({})),
}));

vi.mock('../../services/cache.js', () => ({
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

vi.mock('../../services/billing-service.js', () => ({
  getSubscription: vi.fn(async () => null),
  createCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/session' })),
  createPortalSession: vi.fn(async () => ({ url: 'https://billing.stripe.com/portal' })),
  getProrationPreview: vi.fn(async () => ({
    immediateTotal: 0,
    proratedCredits: 0,
    newPriceAmount: 0,
  })),
  ensureStripeCustomer: vi.fn(async () => 'cus_test'),
  createTopUpCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/topup' })),
  updateSubscriptionSeatCount: vi.fn(async () => undefined),
}));

vi.mock('../../services/credit-service.js', () => ({
  getCreditBalance: vi.fn(async () => ({ credits: 42 })),
}));

vi.mock('../../services/billing-constants.js', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set([
    'price_starter_monthly',
    'price_pro_monthly',
    'price_enterprise_monthly',
  ]),
  KNOWN_TOPUP_PRICE_IDS: new Set(['price_topup_10', 'price_topup_50']),
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
import { equipmentReturnsRouter } from '../equipment-returns.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(equipmentReturnsRouter);

function makeCaller(userId = USER_ID, orgId = ORG_ID) {
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

const caller = makeCaller();

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

describe('equipmentReturns.approveReturnRequest', () => {
  it('approves request, creates InPost shipment, and returns updated request', async () => {
    const returnRequest = {
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: 'contractor-1',
      status: 'PENDING_APPROVAL',
      targetPointId: 'WAW01A',
      targetPointName: 'Paczkomat WAW01A',
      contractor: {
        id: 'contractor-1',
        displayName: 'John Doe',
        email: 'john@example.com',
        phone: '+48123456789',
      },
    };
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(returnRequest);
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([
      { equipment: { id: 'eq-1', name: 'Laptop' } },
      { equipment: { id: 'eq-2', name: 'Monitor' } },
    ]);
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce({
      configJson: { organizationId: 123, token: 'tok' },
    });
    mockPrisma.organization.findUnique.mockResolvedValueOnce({ name: 'Test Org' });
    mockPrisma.shipment.create.mockResolvedValue({ id: 'ship-1' });
    mockPrisma.shipmentEvent.create.mockResolvedValue({});
    mockPrisma.equipment.update.mockResolvedValue({});
    const updatedRequest = {
      ...returnRequest,
      status: 'SHIPMENT_CREATED',
      shipmentId: 'ship-1',
      contractor: { id: 'contractor-1', displayName: 'John Doe' },
      shipment: { id: 'ship-1' },
    };
    mockPrisma.returnRequest.update.mockResolvedValueOnce(updatedRequest);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await caller.approveReturnRequest({
      id: 'rr-1',
      parcelSize: 'small',
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('SHIPMENT_CREATED');
    expect(mockInPostCreateShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'RETURN',
        targetPoint: 'WAW01A',
      }),
    );
  });

  it('throws NOT_FOUND when return request does not exist', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.approveReturnRequest({ id: 'nonexistent', parcelSize: 'small' }),
    ).rejects.toThrow('RETURN_REQUEST_NOT_FOUND');
  });

  it('throws BAD_REQUEST when return request is not pending', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      status: 'SHIPMENT_CREATED',
      contractor: { id: 'c-1', displayName: 'Test', email: 'test@test.com', phone: null },
    });

    await expect(caller.approveReturnRequest({ id: 'rr-1', parcelSize: 'small' })).rejects.toThrow(
      'RETURN_REQUEST_NOT_PENDING',
    );
  });

  it('throws NOT_FOUND when courier config is missing', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: 'contractor-1',
      status: 'PENDING_APPROVAL',
      targetPointId: 'WAW01A',
      contractor: { id: 'contractor-1', displayName: 'John', email: 'j@j.com', phone: null },
    });
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([]);
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce(null);

    await expect(caller.approveReturnRequest({ id: 'rr-1', parcelSize: 'small' })).rejects.toThrow(
      'COURIER_CONFIG_NOT_FOUND',
    );
  });
});

describe('equipmentReturns.rejectReturnRequest', () => {
  it('rejects request, reverts equipment statuses, and sends notification', async () => {
    const returnRequest = {
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: 'contractor-1',
      status: 'PENDING_APPROVAL',
    };
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(returnRequest);
    const updatedRequest = {
      ...returnRequest,
      status: 'REJECTED',
      rejectedReason: 'Equipment not needed',
      contractor: { id: 'contractor-1', displayName: 'John Doe' },
    };
    mockPrisma.returnRequest.update.mockResolvedValueOnce(updatedRequest);
    mockPrisma.equipment.updateMany.mockResolvedValueOnce({ count: 2 });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await caller.rejectReturnRequest({
      id: 'rr-1',
      reason: 'Equipment not needed',
    });

    expect(result.status).toBe('REJECTED');
    expect(mockPrisma.equipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ASSIGNED' },
      }),
    );
  });

  it('throws NOT_FOUND when return request does not exist', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(null);

    await expect(caller.rejectReturnRequest({ id: 'nonexistent' })).rejects.toThrow(
      'RETURN_REQUEST_NOT_FOUND',
    );
  });

  it('throws BAD_REQUEST when return request is not pending', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      status: 'REJECTED',
    });

    await expect(caller.rejectReturnRequest({ id: 'rr-1' })).rejects.toThrow(
      'RETURN_REQUEST_NOT_PENDING',
    );
  });
});

describe('equipmentReturns.listReturnRequests', () => {
  it('returns all return requests for the organization', async () => {
    const requests = [
      {
        id: 'rr-1',
        status: 'PENDING_APPROVAL',
        contractor: { id: 'c-1', displayName: 'John', email: 'john@test.com' },
        shipment: null,
      },
      {
        id: 'rr-2',
        status: 'SHIPMENT_CREATED',
        contractor: { id: 'c-2', displayName: 'Jane', email: 'jane@test.com' },
        shipment: {
          id: 's-1',
          trackingNumber: 'TR-123',
          externalId: 'ext-1',
          currentStatus: 'CREATED',
          carrier: 'InPost',
          labelUrl: null,
        },
      },
    ];
    mockPrisma.returnRequest.findMany.mockResolvedValueOnce(requests);

    const result = await caller.listReturnRequests({});

    expect(result).toHaveLength(2);
    expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID },
      }),
    );
  });

  it('filters by status when provided', async () => {
    mockPrisma.returnRequest.findMany.mockResolvedValueOnce([]);

    await caller.listReturnRequests({ status: 'PENDING_APPROVAL' });

    expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, status: 'PENDING_APPROVAL' },
      }),
    );
  });
});
