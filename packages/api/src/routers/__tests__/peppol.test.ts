/**
 * Peppol router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, integrations, qstash-client, validators, logger, Sentry.
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

const { mockPrisma, mockStoreCredentials, mockGetQStashClient } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockSchedules = {
    create: vi.fn(async () => ({ scheduleId: 'sched-1' })),
    delete: vi.fn(async () => undefined),
  };

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        billingEmail: 'billing@test.com',
        name: 'Test Org',
      })),
    },
    peppolParticipant: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    peppolTransmission: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(async () => 0),
    },
    contractor: { count: vi.fn(async () => 0) },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockStoreCredentials: vi.fn(async () => 'cred-ref-123'),
    mockGetQStashClient: vi.fn(() => ({ schedules: mockSchedules })),
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

vi.mock('@contractor-ops/integrations', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/integrations')>();
  return {
    ...actual,
    storeCredentials: mockStoreCredentials,
  };
});

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: mockGetQStashClient,
}));

vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getServerEnv: vi.fn(() => ({
      CRON_SECRET: 'test-cron-secret',
      NEXT_PUBLIC_APP_URL: 'https://app.test.com',
      DATABASE_URL: 'postgresql://test',
    })),
  };
});

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
import { appRouter } from '../../root.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

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

describe('peppol.connect', () => {
  it('creates participant and connection on successful connect', async () => {
    mockPrisma.peppolParticipant.findFirst.mockResolvedValueOnce(null); // no existing
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null); // no existing connection
    const mockConnection = {
      id: 'conn-1',
      organizationId: ORG_ID,
      provider: 'PEPPOL',
      status: 'CONNECTED',
      configJson: { aspProvider: 'storecove', environment: 'sandbox' },
    };
    mockPrisma.integrationConnection.create.mockResolvedValueOnce(mockConnection);
    const mockParticipant = {
      id: 'part-1',
      organizationId: ORG_ID,
      participantId: '0192:123456789012345',
      schemeId: '0192',
      identifierValue: '123456789012345',
      aspProvider: 'storecove',
      status: 'PENDING',
    };
    mockPrisma.peppolParticipant.create.mockResolvedValueOnce(mockParticipant);
    // QStash schedule update
    mockPrisma.integrationConnection.update.mockResolvedValueOnce(mockConnection);

    const result = await caller.peppol.connect({
      trn: '123456789012345',
      aspProvider: 'storecove',
      environment: 'sandbox',
      apiKey: 'test-api-key',
    });

    expect(result.participant).toBeDefined();
    expect(result.connection).toBeDefined();
    expect(mockStoreCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'test-api-key' }),
      ORG_ID,
      'peppol',
    );
    expect(mockPrisma.peppolParticipant.create).toHaveBeenCalled();
  });

  it('throws CONFLICT when organization already has an active participant', async () => {
    mockPrisma.peppolParticipant.findFirst.mockResolvedValueOnce({
      id: 'part-existing',
      status: 'ACTIVE',
    });

    await expect(
      caller.peppol.connect({
        trn: '123456789012345',
        aspProvider: 'storecove',
        environment: 'sandbox',
        apiKey: 'test-api-key',
      }),
    ).rejects.toThrow('Organization already has an active Peppol participant');
  });

  it('upserts existing IntegrationConnection on reconnect', async () => {
    mockPrisma.peppolParticipant.findFirst.mockResolvedValueOnce(null);
    const existingConn = { id: 'conn-old', organizationId: ORG_ID, configJson: {} };
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(existingConn);
    mockPrisma.integrationConnection.update.mockResolvedValue({
      ...existingConn,
      status: 'CONNECTED',
    });
    mockPrisma.peppolParticipant.create.mockResolvedValueOnce({
      id: 'part-1',
      status: 'PENDING',
    });

    await caller.peppol.connect({
      trn: '123456789012345',
      aspProvider: 'storecove',
      environment: 'sandbox',
      apiKey: 'test-api-key',
    });

    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-old' },
        data: expect.objectContaining({ status: 'CONNECTED' }),
      }),
    );
  });
});

describe('peppol.disconnect', () => {
  it('deregisters participant and disconnects integration', async () => {
    const participant = { id: 'part-1', organizationId: ORG_ID, status: 'ACTIVE' };
    mockPrisma.peppolParticipant.findFirst.mockResolvedValueOnce(participant);
    mockPrisma.peppolParticipant.update.mockResolvedValueOnce({
      ...participant,
      status: 'DEREGISTERED',
    });
    const connection = {
      id: 'conn-1',
      configJson: { qstashScheduleId: 'sched-1' },
    };
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(connection);
    mockPrisma.integrationConnection.update.mockResolvedValueOnce({
      ...connection,
      status: 'DISCONNECTED',
    });

    const result = await caller.peppol.disconnect();

    expect(result).toEqual({ success: true });
    expect(mockPrisma.peppolParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'DEREGISTERED' },
      }),
    );
  });

  it('throws NOT_FOUND when no active participant exists', async () => {
    mockPrisma.peppolParticipant.findFirst.mockResolvedValueOnce(null);

    await expect(caller.peppol.disconnect()).rejects.toThrow();
  });
});

describe('peppol.getStatus', () => {
  it('returns participant and connection when connected', async () => {
    const participant = {
      id: 'part-1',
      status: 'ACTIVE',
      organizationId: ORG_ID,
    };
    mockPrisma.peppolParticipant.findFirst.mockResolvedValueOnce(participant);
    const connection = {
      id: 'conn-1',
      status: 'CONNECTED',
      configJson: {},
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      connectedAt: new Date(),
    };
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(connection);

    const result = await caller.peppol.getStatus();

    expect(result).not.toBeNull();
    expect(result?.participant).toBeDefined();
    expect(result?.connection).toBeDefined();
  });

  it('returns null when no active participant', async () => {
    mockPrisma.peppolParticipant.findFirst.mockResolvedValueOnce(null);

    const result = await caller.peppol.getStatus();

    expect(result).toBeNull();
  });
});

describe('peppol.getTransmissions', () => {
  it('returns paginated list of transmissions', async () => {
    const transmissions = [
      { id: 'tx-1', createdAt: new Date() },
      { id: 'tx-2', createdAt: new Date() },
    ];
    mockPrisma.peppolTransmission.findMany.mockResolvedValueOnce(transmissions);

    const result = await caller.peppol.getTransmissions({ limit: 20 });

    expect(result.transmissions).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  it('returns nextCursor when more results exist', async () => {
    const transmissions = Array.from({ length: 11 }, (_, i) => ({
      id: `tx-${i}`,
      createdAt: new Date(),
    }));
    mockPrisma.peppolTransmission.findMany.mockResolvedValueOnce(transmissions);

    const result = await caller.peppol.getTransmissions({ limit: 10 });

    expect(result.transmissions).toHaveLength(10);
    expect(result.nextCursor).toBe('tx-10');
  });
});

describe('peppol.retryTransmission', () => {
  it('resets a failed transmission to PENDING', async () => {
    const transmission = {
      id: 'tx-1',
      organizationId: ORG_ID,
      status: 'FAILED',
      errorMessage: 'Network timeout',
    };
    mockPrisma.peppolTransmission.findFirst.mockResolvedValueOnce(transmission);
    const updated = { ...transmission, status: 'PENDING', errorMessage: null };
    mockPrisma.peppolTransmission.update.mockResolvedValueOnce(updated);

    const result = await caller.peppol.retryTransmission({
      transmissionId: 'clxxxxxxxxxxxxxxxxxtx001',
    });

    expect(result.status).toBe('PENDING');
    expect(result.errorMessage).toBeNull();
  });

  it('throws NOT_FOUND for non-existent or non-retryable transmission', async () => {
    mockPrisma.peppolTransmission.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.peppol.retryTransmission({ transmissionId: 'clxxxxxxxxxxxxxxxxxnoext' }),
    ).rejects.toThrow('Failed transmission not found');
  });
});
