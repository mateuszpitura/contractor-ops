/**
 * Equipment Couriers router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, courier clients, equipment-workflow, logger, Sentry.
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

const {
  mockPrisma,
  mockInPostCreateShipment,
  mockInPostGetLabel,
  mockDPDCreateShipment,
  mockUPSCreateShipment,
  mockGetCourierClient,
  mockCheckShipmentTaskCompletion,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        status: 'ACTIVE',
        billingEmail: 'billing@test.com',
        name: 'Test Org',
      })),
    },
    courierConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
      upsert: vi.fn(),
    },
    equipment: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    shipment: {
      create: vi.fn(),
      createMany: vi.fn(async () => ({ count: 0 })),
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
    },
    shipmentEvent: {
      create: vi.fn(),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    contractor: {
      count: vi.fn(async () => 0),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockInPostCreateShipment: vi.fn(async () => ({
      trackingNumber: 'INPOST-123',
      externalId: 'ext-inpost-1',
      labelUrl: 'https://labels.inpost.com/label.pdf',
    })),
    mockInPostGetLabel: vi.fn(async () => Buffer.from('pdf-content')),
    mockDPDCreateShipment: vi.fn(async () => ({
      trackingNumber: 'DPD-456',
      externalId: 'ext-dpd-1',
      labelUrl: null,
    })),
    mockUPSCreateShipment: vi.fn(async () => ({
      trackingNumber: 'UPS-789',
      externalId: 'ext-ups-1',
      labelUrl: null,
    })),
    mockGetCourierClient: vi.fn(),
    mockCheckShipmentTaskCompletion: vi.fn(async () => undefined),
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

// F-DB-03 / F-SEC-12 — org-cache must report ACTIVE so tenant middleware
// does not throw orgSuspended.
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

vi.mock('../../services/courier/inpost-client', () => ({
  InPostClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.createShipment = mockInPostCreateShipment;
    this.getLabel = mockInPostGetLabel;
  }),
}));

vi.mock('../../services/courier/dpd-client', () => ({
  DPDClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.createShipment = mockDPDCreateShipment;
  }),
}));

vi.mock('../../services/courier/ups-client', () => ({
  UPSClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.createShipment = mockUPSCreateShipment;
  }),
}));

vi.mock('../../services/courier/carrier-factory', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/courier/carrier-factory')>();
  return {
    ...actual,
    getCourierClient: mockGetCourierClient,
  };
});

vi.mock('../../services/equipment-workflow', () => ({
  checkShipmentTaskCompletion: mockCheckShipmentTaskCompletion,
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

vi.mock('../../services/billing-service', () => ({
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

vi.mock('../../services/credit-service', () => ({
  getCreditBalance: vi.fn(async () => ({ credits: 42 })),
}));

vi.mock('../../services/billing-constants', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set([
    'price_starter_monthly',
    'price_pro_monthly',
    'price_enterprise_monthly',
  ]),
  KNOWN_TOPUP_PRICE_IDS: new Set(['price_topup_10', 'price_topup_50']),
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

vi.mock('@sentry/nextjs', () => {
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init';
import { equipmentCouriersRouter } from '../equipment/equipment-couriers';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(equipmentCouriersRouter);

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
// Helpers
// ---------------------------------------------------------------------------

function makeEquipmentItem(id: string, status = 'ASSIGNED') {
  return {
    id,
    organizationId: ORG_ID,
    status,
    assignments: [
      {
        contractor: {
          id: 'contractor-1',
          displayName: 'John Doe',
          email: 'john@example.com',
          phone: '+48123456789',
          preferredPaczkomatId: null,
          preferredPaczkomatName: null,
          preferredPaczkomatAddress: null,
        },
      },
    ],
  };
}

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

describe('equipmentCouriers.createInPostShipment', () => {
  it('creates InPost shipment and returns result', async () => {
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce({
      configJson: { organizationId: 123, token: 'tok' },
    });
    const equipment = [makeEquipmentItem('eq-1')];
    mockPrisma.equipment.findMany.mockResolvedValueOnce(equipment);
    mockPrisma.organization.findUnique.mockResolvedValueOnce({ name: 'Test Org' });
    const createdShipment = {
      id: 'ship-1',
      trackingNumber: 'INPOST-123',
      externalId: 'ext-inpost-1',
    };
    mockPrisma.shipment.create.mockResolvedValueOnce(createdShipment);
    mockPrisma.shipmentEvent.create.mockResolvedValue({});
    mockPrisma.equipment.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.shipment.findMany.mockResolvedValueOnce([{ ...createdShipment, events: [] }]);

    const result = await caller.createInPostShipment({
      equipmentIds: ['eq-1'],
      direction: 'OUTBOUND',
      targetPointId: 'WAW01A',
      targetPointName: 'Paczkomat WAW01A',
      targetPointAddress: 'ul. Testowa 1, Warszawa',
      parcelSize: 'small',
    });

    expect(result).toBeDefined();
    expect(mockInPostCreateShipment).toHaveBeenCalled();
  });

  it('throws NOT_FOUND when courier config missing', async () => {
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce(null);

    await expect(
      caller.createInPostShipment({
        equipmentIds: ['eq-1'],
        direction: 'OUTBOUND',
        targetPointId: 'WAW01A',
        targetPointName: 'Paczkomat WAW01A',
        targetPointAddress: 'ul. Testowa 1, Warszawa',
        parcelSize: 'small',
      }),
    ).rejects.toThrow('COURIER_CONFIG_NOT_FOUND');
  });

  it('throws NOT_FOUND when equipment item not found', async () => {
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce({
      configJson: { organizationId: 123, token: 'tok' },
    });
    mockPrisma.equipment.findMany.mockResolvedValueOnce([]); // no items found

    await expect(
      caller.createInPostShipment({
        equipmentIds: ['eq-missing'],
        direction: 'OUTBOUND',
        targetPointId: 'WAW01A',
        targetPointName: 'Paczkomat WAW01A',
        targetPointAddress: 'ul. Testowa 1, Warszawa',
        parcelSize: 'small',
      }),
    ).rejects.toThrow();
  });

  it('throws BAD_REQUEST when equipment not assigned', async () => {
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce({
      configJson: { organizationId: 123, token: 'tok' },
    });
    mockPrisma.equipment.findMany.mockResolvedValueOnce([
      { id: 'eq-1', organizationId: ORG_ID, status: 'AVAILABLE', assignments: [] },
    ]);

    await expect(
      caller.createInPostShipment({
        equipmentIds: ['eq-1'],
        direction: 'OUTBOUND',
        targetPointId: 'WAW01A',
        targetPointName: 'Paczkomat WAW01A',
        targetPointAddress: 'ul. Testowa 1, Warszawa',
        parcelSize: 'small',
      }),
    ).rejects.toThrow();
  });
});

describe('equipmentCouriers.saveCourierConfig', () => {
  it('upserts courier config and creates audit log', async () => {
    mockPrisma.courierConfig.upsert.mockResolvedValueOnce({});
    mockPrisma.auditLog.create.mockResolvedValueOnce({});

    const result = await caller.saveCourierConfig({
      carrier: 'dpd',
      username: 'dpd-user',
      password: 'dpd-pass',
      fid: '12345',
    });

    expect(result).toEqual({ success: true });
    expect(mockPrisma.courierConfig.upsert).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});

describe('equipmentCouriers.getCourierConfigs', () => {
  it('returns list of configured carriers without credentials', async () => {
    const configs = [
      { carrier: 'inpost', createdAt: new Date(), updatedAt: new Date() },
      { carrier: 'dpd', createdAt: new Date(), updatedAt: new Date() },
    ];
    mockPrisma.courierConfig.findMany.mockResolvedValueOnce(configs);

    const result = await caller.getCourierConfigs();

    expect(result).toEqual(configs);
    expect(mockPrisma.courierConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID },
        select: { carrier: true, createdAt: true, updatedAt: true },
      }),
    );
  });
});

describe('equipmentCouriers.testCourierConnection', () => {
  it('returns success when API probe succeeds with not-found error', async () => {
    mockGetCourierClient.mockReturnValueOnce({
      getStatus: vi.fn().mockRejectedValueOnce(new Error('Shipment not found (404)')),
    });

    const result = await caller.testCourierConnection({
      carrier: 'dpd',
      username: 'dpd-user',
      password: 'dpd-pass',
      fid: '12345',
    });

    expect(result.success).toBe(true);
  });

  it('returns failure on auth error', async () => {
    mockGetCourierClient.mockReturnValueOnce({
      getStatus: vi.fn().mockRejectedValueOnce(new Error('Invalid credentials')),
    });

    const result = await caller.testCourierConnection({
      carrier: 'dpd',
      username: 'dpd-user',
      password: 'wrong-pass',
      fid: '12345',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection failed. Check your credentials.');
  });
});

describe('equipmentCouriers.getShipmentLabel', () => {
  it('returns base64-encoded label for InPost shipment', async () => {
    mockPrisma.shipment.findFirst.mockResolvedValueOnce({
      id: 'ship-1',
      organizationId: ORG_ID,
      carrier: 'InPost',
      externalId: 'ext-1',
      trackingNumber: 'INPOST-123',
    });
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce({
      configJson: { organizationId: 123, token: 'tok' },
    });

    const result = await caller.getShipmentLabel({
      shipmentId: 'ship-1',
    });

    expect(result.contentType).toBe('application/pdf');
    expect(result.data).toBeDefined();
    expect(result.filename).toContain('INPOST-123');
  });

  it('throws NOT_FOUND when shipment does not exist', async () => {
    mockPrisma.shipment.findFirst.mockResolvedValueOnce(null);

    await expect(caller.getShipmentLabel({ shipmentId: 'nonexistent' })).rejects.toThrow();
  });

  it('throws BAD_REQUEST for non-InPost shipments', async () => {
    mockPrisma.shipment.findFirst.mockResolvedValueOnce({
      id: 'ship-1',
      organizationId: ORG_ID,
      carrier: 'DPD',
      externalId: 'ext-1',
    });

    await expect(caller.getShipmentLabel({ shipmentId: 'ship-1' })).rejects.toThrow(
      'SHIPMENT_NO_INPOST_LABEL',
    );
  });
});
