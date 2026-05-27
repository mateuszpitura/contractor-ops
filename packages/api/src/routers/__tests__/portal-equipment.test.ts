/**
 * Portal equipment router tests.
 *
 * Tests listEquipment, getReturnStatus endpoints on the portal router.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-portal-eq-001';
const CONTRACTOR_ID = 'contractor-portal-eq-001';
const SESSION_TOKEN = 'portal-session-token-equipment';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    equipmentAssignment: {
      findMany: vi.fn(),
    },
    returnRequest: {
      findFirst: vi.fn(),
    },
    contractor: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contractorBillingProfile: {
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    contract: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    invoice: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    portalNotificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
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

vi.mock('../../services/portal-session', () => ({
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

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/courier/inpost-client', () => ({
  InPostClient: vi.fn().mockImplementation(() => ({
    createShipment: vi.fn(async () => ({
      externalId: 'ext-123',
      trackingNumber: 'TRACK123',
      status: 'created',
      labelUrl: 'https://shipx.test/label',
    })),
    getLabel: vi.fn(async () => Buffer.from('pdf-content')),
    getStatus: vi.fn(),
    cancelShipment: vi.fn(),
  })),
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

// Mock Teams dependencies that may not be installed
vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: { init: vi.fn() },
}));

vi.mock('botbuilder', () => ({
  TeamsActivityHandler: class {},
  TurnContext: class {},
  CloudAdapter: class {},
  ConfigurationBotFrameworkAuthentication: class {},
}));

vi.mock('botframework-connector', () => ({
  MicrosoftAppCredentials: { trustServiceUrl: vi.fn() },
  ConnectorClient: class {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { portalAppRouter } from '../../portal-root';

// ---------------------------------------------------------------------------
// Caller setup
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(portalAppRouter);

function portalCaller() {
  return createCaller({
    headers: new Headers({
      cookie: `portal_session=${SESSION_TOKEN}`,
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('portal.listEquipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns assigned equipment for authenticated contractor with latest shipment status', async () => {
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([
      {
        id: 'assign-1',
        assignedAt: new Date('2026-01-01'),
        equipment: {
          id: 'eq-1',
          name: 'MacBook Pro',
          serialNumber: 'SN001',
          type: 'LAPTOP',
          status: 'DELIVERED',
          shipments: [
            {
              id: 'ship-1',
              direction: 'OUTBOUND',
              carrier: 'InPost',
              trackingNumber: 'TRACK001',
              currentStatus: 'DELIVERED',
              expectedDeliveryAt: null,
            },
          ],
        },
      },
    ]);

    const caller = portalCaller();
    const result = await caller.portal.listEquipment();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      assignmentId: 'assign-1',
      equipment: {
        id: 'eq-1',
        name: 'MacBook Pro',
        serialNumber: 'SN001',
        type: 'LAPTOP',
        status: 'DELIVERED',
      },
    });
    expect(result[0]?.latestShipment).toMatchObject({
      direction: 'OUTBOUND',
      carrier: 'InPost',
      trackingNumber: 'TRACK001',
      currentStatus: 'DELIVERED',
    });
  });

  it('returns empty array for contractor with no assignments', async () => {
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([]);

    const caller = portalCaller();
    const result = await caller.portal.listEquipment();

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});

describe('portal.getReturnStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current ReturnRequest status for contractor', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      status: 'PENDING_APPROVAL',
      targetPointId: 'KRA001',
      targetPointName: 'Krakow Paczkomat',
      targetPointAddress: 'ul. Testowa 1',
      createdAt: new Date('2026-04-01'),
      shipment: null,
    });

    const caller = portalCaller();
    const result = await caller.portal.getReturnStatus();

    expect(result).toMatchObject({
      id: 'rr-1',
      status: 'PENDING_APPROVAL',
      targetPointId: 'KRA001',
    });
  });
});
