/**
 * Portal profile router tests.
 *
 * Tests getProfile, updateContactInfo, submitFinancialChangeRequest procedures.
 * Uses the full tRPC caller with mocked Prisma, auth, and service dependencies.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-profile-001';
const CONTRACTOR_ID = 'contractor-profile-001';
const SESSION_TOKEN = 'portal-session-token-profile';

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
    contractor: {
      findUnique: vi.fn(),
      // submitFinancialChangeRequest uses findFirst (lookup by portal session token, not pk).
      findFirst: vi.fn(),
      update: vi.fn(),
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
import { createChangeRequest } from '../../services/portal-change-request.js';

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
// getProfile
// ===========================================================================

describe('portal.getProfile', () => {
  it('returns contractor contact info and masked billing profile', async () => {
    mockPrisma.contractor.findUnique.mockResolvedValue({
      id: CONTRACTOR_ID,
      displayName: 'Test Contractor',
      email: 'contractor@test.com',
      phone: '+48123456789',
      addressLine1: '123 Test St',
      addressLine2: null,
      city: 'Warsaw',
      postalCode: '00-001',
      countryCode: 'PL',
      taxId: '1234567890',
    });

    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue({
      id: 'bp-1',
      bankAccountMasked: '****5678',
      bankName: 'PKO Bank',
      swiftBic: 'BPKOPLPW',
      taxId: '1234567890',
    });

    mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);

    const result = await caller.portal.getProfile();

    expect(result.displayName).toBe('Test Contractor');
    expect(result.billingProfile?.bankAccountMasked).toBe('****5678');
    expect(result.pendingChangeRequest).toBeNull();

    // Verify contractor lookup uses contractorId
    expect(mockPrisma.contractor.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTRACTOR_ID },
      }),
    );
  });

  it('never exposes bankAccountEncrypted in response', async () => {
    mockPrisma.contractor.findUnique.mockResolvedValue({
      id: CONTRACTOR_ID,
      displayName: 'Test',
      email: 'test@test.com',
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: null,
      taxId: null,
    });

    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue({
      id: 'bp-1',
      bankAccountMasked: '****9999',
      bankName: 'Bank',
      swiftBic: 'SWIFT',
      taxId: '123',
    });

    mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);

    const result = await caller.portal.getProfile();

    // The select clause should never include bankAccountEncrypted
    const selectArg = mockPrisma.contractorBillingProfile.findFirst.mock.calls[0][0].select;
    expect(selectArg).not.toHaveProperty('bankAccountEncrypted');
    expect(
      (result.billingProfile as Record<string, unknown>)?.bankAccountEncrypted,
    ).toBeUndefined();
  });

  it('includes pendingChangeRequest when one exists with status PENDING', async () => {
    mockPrisma.contractor.findUnique.mockResolvedValue({
      id: CONTRACTOR_ID,
      displayName: 'Test',
      email: 'test@test.com',
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: null,
      taxId: null,
    });

    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue(null);

    const pendingCR = {
      id: 'cr-1',
      requestedChanges: { bankName: 'New Bank' },
      createdAt: new Date('2025-06-01'),
    };
    mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(pendingCR);

    const result = await caller.portal.getProfile();

    expect(result.pendingChangeRequest).toBeTruthy();
    expect(result.pendingChangeRequest?.id).toBe('cr-1');

    // Verify the WHERE clause filters by status PENDING
    const whereArg = mockPrisma.contractorChangeRequest.findFirst.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
    });
  });

  it('returns null pendingChangeRequest when none pending', async () => {
    mockPrisma.contractor.findUnique.mockResolvedValue({
      id: CONTRACTOR_ID,
      displayName: 'Test',
      email: 'test@test.com',
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: null,
      taxId: null,
    });

    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue(null);
    mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);

    const result = await caller.portal.getProfile();

    expect(result.pendingChangeRequest).toBeNull();
  });
});

// ===========================================================================
// updateContactInfo
// ===========================================================================

describe('portal.updateContactInfo', () => {
  it('updates contractor contact fields immediately without approval (PORT-06a)', async () => {
    const updatedData = {
      id: CONTRACTOR_ID,
      displayName: 'Updated Name',
      phone: '+48999888777',
      addressLine1: '456 New St',
      addressLine2: null,
      city: 'Krakow',
      postalCode: '30-001',
      countryCode: 'PL',
    };
    mockPrisma.contractor.update.mockResolvedValue(updatedData);

    const result = await caller.portal.updateContactInfo({
      displayName: 'Updated Name',
      phone: '+48999888777',
      addressLine1: '456 New St',
      city: 'Krakow',
      postalCode: '30-001',
      countryCode: 'PL',
    });

    expect(result.displayName).toBe('Updated Name');
    expect(result.city).toBe('Krakow');

    // Verify the update uses the correct contractorId
    expect(mockPrisma.contractor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTRACTOR_ID },
        data: expect.objectContaining({
          displayName: 'Updated Name',
          phone: '+48999888777',
        }),
      }),
    );
  });

  it('validates displayName is non-empty and max 200 chars', async () => {
    // Empty displayName should fail validation
    await expect(
      caller.portal.updateContactInfo({
        displayName: '',
      }),
    ).rejects.toThrow();

    // displayName over 200 chars should fail
    await expect(
      caller.portal.updateContactInfo({
        displayName: 'a'.repeat(201),
      }),
    ).rejects.toThrow();
  });

  it('accepts optional nullable phone, address, city, postalCode, countryCode', async () => {
    mockPrisma.contractor.update.mockResolvedValue({
      id: CONTRACTOR_ID,
      displayName: 'Name',
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: null,
    });

    const result = await caller.portal.updateContactInfo({
      displayName: 'Name',
      phone: null,
      addressLine1: null,
      city: null,
      postalCode: null,
      countryCode: null,
    });

    expect(result.displayName).toBe('Name');
    expect(result.phone).toBeNull();
  });
});

// ===========================================================================
// submitFinancialChangeRequest
// ===========================================================================

describe('portal.submitFinancialChangeRequest', () => {
  beforeEach(() => {
    // Source reads contractor for tax-ID validation/snapshot before issuing the change request.
    mockPrisma.contractor.findFirst.mockResolvedValue({
      countryCode: 'PL',
      taxId: null,
    });
  });

  it('creates ContractorChangeRequest with requested financial changes (PORT-06b)', async () => {
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue({
      bankAccountMasked: '****1111',
      bankName: 'Old Bank',
      swiftBic: 'OLDSWIFT',
      taxId: 'OLD123',
    });

    const mockCR = {
      id: 'cr-new',
      status: 'PENDING',
      createdAt: new Date('2025-07-01'),
    };
    (createChangeRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCR);

    const result = await caller.portal.submitFinancialChangeRequest({
      bankName: 'New Bank',
      swiftBic: 'NEWSWIFT',
    });

    expect(result.id).toBe('cr-new');
    expect(result.status).toBe('PENDING');
    expect(createChangeRequest).toHaveBeenCalledWith(
      CONTRACTOR_ID,
      ORG_ID,
      expect.objectContaining({ bankName: 'New Bank', swiftBic: 'NEWSWIFT' }),
      expect.objectContaining({ bankAccountMasked: '****1111', bankName: 'Old Bank' }),
    );
  });

  it('strips whitespace from bank account number and creates masked value', async () => {
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue({
      bankAccountMasked: null,
      bankName: null,
      swiftBic: null,
      taxId: null,
    });

    (createChangeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'cr-bank',
      status: 'PENDING',
      createdAt: new Date(),
    });

    await caller.portal.submitFinancialChangeRequest({
      bankAccountNumber: 'PL 12 3456 7890 1234 5678 9012 3456',
    });

    // Verify the requestedChanges contain encrypted + masked values
    const requestedChanges = (createChangeRequest as ReturnType<typeof vi.fn>).mock.calls[0][2];
    // Whitespace stripped: "PL12345678901234567890123456"
    expect(requestedChanges.bankAccountEncrypted).toBe('encrypted:PL12345678901234567890123456');
    expect(requestedChanges.bankAccountMasked).toBe('****3456');
  });

  it('snapshots current billing profile values as previousValues', async () => {
    const currentProfile = {
      bankAccountMasked: '****9999',
      bankName: 'Current Bank',
      swiftBic: 'CURSWIFT',
      taxId: 'CUR123',
    };
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue(currentProfile);

    (createChangeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'cr-snap',
      status: 'PENDING',
      createdAt: new Date(),
    });

    await caller.portal.submitFinancialChangeRequest({
      bankName: 'New Bank',
    });

    const previousValues = (createChangeRequest as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(previousValues).toMatchObject({
      bankAccountMasked: '****9999',
      bankName: 'Current Bank',
      swiftBic: 'CURSWIFT',
      taxId: 'CUR123',
    });
  });

  it('throws BAD_REQUEST when no changes are provided', async () => {
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue(null);

    await expect(caller.portal.submitFinancialChangeRequest({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('propagates CONFLICT when createChangeRequest rejects with pending duplicate', async () => {
    const { TRPCError } = await import('@trpc/server');
    vi.mocked(createChangeRequest).mockRejectedValueOnce(
      new TRPCError({
        code: 'CONFLICT',
        message: 'PORTAL_PENDING_CHANGE_EXISTS',
      }),
    );

    await expect(
      caller.portal.submitFinancialChangeRequest({ bankName: 'Dup Bank' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
