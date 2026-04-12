/**
 * Tests for testCourierConnection tRPC procedure.
 *
 * Verifies that the procedure instantiates the correct carrier client,
 * probes credentials via getStatus, and returns structured success/failure
 * without leaking internal error details.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-test-conn-001';
const USER_ID = 'user-test-conn-001';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockCourierClient } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    equipmentAssignment: { findMany: vi.fn() },
    returnRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    equipment: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    shipment: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    shipmentEvent: { create: vi.fn() },
    contractor: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    contractorBillingProfile: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    courierConfig: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    contract: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    invoice: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    document: { findMany: vi.fn() },
    portalNotificationPreference: { findMany: vi.fn(), upsert: vi.fn() },
    workflowTaskRun: { update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    workflowRun: { update: vi.fn() },
    $transaction: vi.fn(async (fnOrArray: unknown) => {
      if (typeof fnOrArray === 'function') {
        return (fnOrArray as (tx: Rec) => Promise<unknown>)(mockPrisma);
      }
      return fnOrArray;
    }),
  };

  const mockCourierClient = {
    createShipment: vi.fn(),
    getLabel: vi.fn(),
    getStatus: vi.fn(),
    cancelShipment: vi.fn(),
  };

  return { mockPrisma, mockCourierClient };
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
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/equipment-workflow.js', () => ({
  checkShipmentTaskCompletion: vi.fn(),
}));

vi.mock('../../services/courier/carrier-factory.js', () => ({
  getCourierClient: vi.fn(() => mockCourierClient),
}));

vi.mock('../../services/courier/inpost-client.js', () => ({
  InPostClient: class MockInPostClient {
    createShipment = vi.fn();
    getLabel = vi.fn();
    getStatus = vi.fn();
    cancelShipment = vi.fn();
  },
}));

vi.mock('../../services/courier/dpd-client.js', () => ({
  DPDClient: class MockDPDClient {
    createShipment = vi.fn();
    getLabel = vi.fn();
    getStatus = vi.fn();
    cancelShipment = vi.fn();
  },
}));

vi.mock('../../services/courier/ups-client.js', () => ({
  UPSClient: class MockUPSClient {
    createShipment = vi.fn();
    getLabel = vi.fn();
    getStatus = vi.fn();
    cancelShipment = vi.fn();
  },
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

vi.mock('../../services/r2.js', () => ({
  createPresignedUploadUrl: vi.fn(async () => ({ url: 'https://r2.test/upload', key: 'k' })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.test/download'),
  generateStorageKey: vi.fn(() => 'mock-key'),
}));

vi.mock('../../services/portal-session.js', () => ({
  validatePortalSession: vi.fn(async () => null),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('../../services/portal-magic-link.js', () => ({
  createMagicLinkToken: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
  findContractorsByEmail: vi.fn(),
  sendPortalMagicLink: vi.fn(),
}));

vi.mock('../../services/portal-change-request.js', () => ({
  createChangeRequest: vi.fn(),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('@contractor-ops/logger', () => ({
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

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';
import { getCourierClient } from '../../services/courier/carrier-factory.js';

// ---------------------------------------------------------------------------
// Caller setup — admin caller
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeAdminCaller() {
  const session = {
    session: {
      id: 'session-1',
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
      name: 'Admin User',
      email: 'admin@test.com',
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

const caller = makeAdminCaller();

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('equipment.testCourierConnection', () => {
  it('returns success:true when DPD credentials are valid', async () => {
    mockCourierClient.getStatus.mockResolvedValueOnce({
      externalId: 'TEST_CONNECTION_PROBE',
      status: 'unknown',
    });

    const result = await caller.equipment.testCourierConnection({
      carrier: 'dpd',
      username: 'dpd-user',
      password: 'dpd-pass',
      fid: 'dpd-fid-123',
      sandbox: true,
    });

    expect(result).toEqual({ success: true });
    expect(getCourierClient).toHaveBeenCalledWith('dpd', {
      username: 'dpd-user',
      password: 'dpd-pass',
      fid: 'dpd-fid-123',
      sandbox: true,
    });
    expect(mockCourierClient.getStatus).toHaveBeenCalledWith('TEST_CONNECTION_PROBE');
  });

  it('returns success:true when UPS credentials are valid', async () => {
    mockCourierClient.getStatus.mockResolvedValueOnce({
      externalId: 'TEST_CONNECTION_PROBE',
      status: 'unknown',
    });

    const result = await caller.equipment.testCourierConnection({
      carrier: 'ups',
      clientId: 'ups-client-id',
      clientSecret: 'ups-secret',
      accountNumber: 'ups-account-123',
      sandbox: true,
    });

    expect(result).toEqual({ success: true });
    expect(getCourierClient).toHaveBeenCalledWith('ups', {
      clientId: 'ups-client-id',
      clientSecret: 'ups-secret',
      accountNumber: 'ups-account-123',
      sandbox: true,
    });
  });

  it('returns success:true when carrier responds with shipment-not-found (auth succeeded)', async () => {
    mockCourierClient.getStatus.mockRejectedValueOnce(new Error('Shipment not found (404)'));

    const result = await caller.equipment.testCourierConnection({
      carrier: 'dpd',
      username: 'dpd-user',
      password: 'dpd-pass',
      fid: 'dpd-fid-123',
      sandbox: true,
    });

    expect(result).toEqual({ success: true });
  });

  it('returns success:false with generic error when auth fails', async () => {
    mockCourierClient.getStatus.mockRejectedValueOnce(
      new Error('401 Unauthorized: Invalid credentials'),
    );

    const result = await caller.equipment.testCourierConnection({
      carrier: 'dpd',
      username: 'bad-user',
      password: 'bad-pass',
      fid: 'bad-fid',
      sandbox: true,
    });

    expect(result).toEqual({
      success: false,
      error: 'Connection failed. Check your credentials.',
    });
  });
});
