/**
 * E-sign router tests.
 *
 * Tests the esign router procedures for signing envelope management.
 * sendForSignature/getSigningUrl/voidEnvelope/resendToRecipient delegate to
 * the esign-orchestrator service, so we test the router-level logic:
 * permission checks, org scoping, and the portal signing URL access control.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-esign-001';
const USER_ID = 'user-esign-001';
const CONTRACTOR_ID = 'contractor-esign-001';
const PORTAL_SESSION_TOKEN = 'portal-session-token-esign';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockSendForSignature,
  mockGetSigningUrl,
  mockVoidEnvelope,
  mockResendToRecipient,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    signingEnvelope: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    signingRecipient: {
      findMany: vi.fn(),
    },
    integrationConnection: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockSendForSignature: vi.fn(),
    mockGetSigningUrl: vi.fn(),
    mockVoidEnvelope: vi.fn(),
    mockResendToRecipient: vi.fn(),
  };
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

vi.mock('../../services/esign-orchestrator.js', () => ({
  sendForSignature: mockSendForSignature,
  getSigningUrl: mockGetSigningUrl,
  voidEnvelope: mockVoidEnvelope,
  resendToRecipient: mockResendToRecipient,
}));

vi.mock('../../services/portal-session.js', () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== PORTAL_SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      contractor: { id: CONTRACTOR_ID, email: 'signer@test.com' },
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
import { appRouter } from '../../root.js';

// ---------------------------------------------------------------------------
// Caller setup
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeTenantCaller() {
  const session = {
    session: {
      id: 'session-esign',
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
      name: 'E-sign User',
      email: 'esign@test.com',
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

function makePortalCaller() {
  return createCaller({
    headers: new Headers({ cookie: `portal_session=${PORTAL_SESSION_TOKEN}` }),
    session: null as never,
    user: null as never,
  });
}

const tenantCaller = makeTenantCaller();
const portalCaller = makePortalCaller();

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// sendForSignature
// ===========================================================================

describe('esign.sendForSignature', () => {
  it('creates envelope and updates contract status to PENDING_SIGNATURE', async () => {
    const mockEnvelope = {
      id: 'env-1',
      status: 'SENT',
      contractId: 'contract-1',
    };
    mockSendForSignature.mockResolvedValue(mockEnvelope);

    const result = await tenantCaller.esign.sendForSignature({
      documentId: 'doc-1',
      connectionId: 'conn-1',
      provider: 'DOCUSIGN',
      signers: [{ name: 'Signer A', email: 'a@test.com', role: 'signer', routingOrder: 1 }],
    });

    expect(result.id).toBe('env-1');
    expect(mockSendForSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        userId: USER_ID,
        documentId: 'doc-1',
        connectionId: 'conn-1',
        provider: 'DOCUSIGN',
      }),
    );
  });
});

// ===========================================================================
// getEnvelopeDetail
// ===========================================================================

describe('esign.getEnvelopeDetail', () => {
  it('returns envelope with recipients and events scoped to organization', async () => {
    const envelopeData = {
      id: 'env-detail-1',
      organizationId: ORG_ID,
      status: 'SENT',
      recipients: [
        { id: 'r1', name: 'Signer', email: 's@test.com', routingOrder: 1, status: 'PENDING' },
      ],
      events: [{ id: 'e1', occurredAt: new Date('2025-06-01'), eventType: 'SENT' }],
      sentBy: { id: USER_ID, name: 'User', email: 'user@test.com' },
    };
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue(envelopeData);

    const result = await tenantCaller.esign.getEnvelopeDetail({
      envelopeId: 'env-detail-1',
    });

    expect(result).toBeTruthy();
    expect(result?.id).toBe('env-detail-1');

    // Verify org scoping in WHERE clause
    const findArgs = mockPrisma.signingEnvelope.findFirst.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({
      id: 'env-detail-1',
      organizationId: ORG_ID,
    });
  });
});

// ===========================================================================
// getPortalSigningUrl
// ===========================================================================

describe('esign.getPortalSigningUrl', () => {
  it('returns signing URL when contractor is a recipient', async () => {
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue({
      id: 'env-portal-1',
      organizationId: ORG_ID,
      recipients: [{ email: 'signer@test.com' }],
    });

    mockGetSigningUrl.mockResolvedValue({ url: 'https://docusign.test/sign' });

    const result = await portalCaller.esign.getPortalSigningUrl({
      envelopeId: 'env-portal-1',
      recipientEmail: 'signer@test.com',
      returnUrl: 'https://portal.test/done',
    });

    expect(result.url).toBe('https://docusign.test/sign');
  });

  it('throws FORBIDDEN when contractor is not a recipient', async () => {
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue({
      id: 'env-portal-2',
      organizationId: ORG_ID,
      recipients: [{ email: 'other@test.com' }],
    });

    await expect(
      portalCaller.esign.getPortalSigningUrl({
        envelopeId: 'env-portal-2',
        recipientEmail: 'signer@test.com',
        returnUrl: 'https://portal.test/done',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws NOT_FOUND when envelope does not exist', async () => {
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue(null);

    await expect(
      portalCaller.esign.getPortalSigningUrl({
        envelopeId: 'nonexistent',
        recipientEmail: 'signer@test.com',
        returnUrl: 'https://portal.test/done',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ===========================================================================
// voidEnvelope & resendToRecipient — delegate to service
// ===========================================================================

describe('esign.voidEnvelope', () => {
  it('voids envelope and returns success', async () => {
    mockVoidEnvelope.mockResolvedValue(undefined);

    const result = await tenantCaller.esign.voidEnvelope({
      envelopeId: 'env-void-1',
      reason: 'Cancelled by admin',
    });

    expect(result.success).toBe(true);
    expect(mockVoidEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        envelopeId: 'env-void-1',
        reason: 'Cancelled by admin',
      }),
    );
  });
});

describe('esign.resendToRecipient', () => {
  it('sends reminder to specific signer', async () => {
    mockResendToRecipient.mockResolvedValue(undefined);

    const result = await tenantCaller.esign.resendToRecipient({
      envelopeId: 'env-resend-1',
      recipientEmail: 'signer@test.com',
    });

    expect(result.success).toBe(true);
    expect(mockResendToRecipient).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        envelopeId: 'env-resend-1',
        recipientEmail: 'signer@test.com',
      }),
    );
  });
});

// ===========================================================================
// getSigningUrl
// ===========================================================================

describe('esign.getSigningUrl', () => {
  it('delegates to getSigningUrl orchestrator with org scope', async () => {
    mockGetSigningUrl.mockResolvedValue({ url: 'https://docusign.test/embed' });

    const result = await tenantCaller.esign.getSigningUrl({
      envelopeId: 'env-sign-1',
      recipientEmail: 'signer@test.com',
      returnUrl: 'https://app.test/done',
    });

    expect(result.url).toBe('https://docusign.test/embed');
    expect(mockGetSigningUrl).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      envelopeId: 'env-sign-1',
      recipientEmail: 'signer@test.com',
      returnUrl: 'https://app.test/done',
    });
  });
});

// ===========================================================================
// listConnections
// ===========================================================================

describe('esign.listConnections', () => {
  it('returns connected e-sign providers scoped to organization', async () => {
    mockPrisma.integrationConnection.findMany.mockResolvedValue([
      { id: 'conn-1', provider: 'DOCUSIGN', status: 'CONNECTED', displayName: 'DocuSign' },
    ]);

    const result = await tenantCaller.esign.listConnections();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ provider: 'DOCUSIGN', status: 'CONNECTED' });

    const findCall = mockPrisma.integrationConnection.findMany.mock.calls[0][0];
    expect(findCall.where).toMatchObject({
      organizationId: ORG_ID,
      provider: { in: ['DOCUSIGN', 'AUTENTI'] },
      status: 'CONNECTED',
    });
  });

  it('returns empty array when no connections exist', async () => {
    mockPrisma.integrationConnection.findMany.mockResolvedValue([]);

    const result = await tenantCaller.esign.listConnections();

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// listEnvelopes
// ===========================================================================

describe('esign.listEnvelopes', () => {
  it('returns envelopes with recipient summary scoped to contract', async () => {
    mockPrisma.signingEnvelope.findMany.mockResolvedValue([
      {
        id: 'env-list-1',
        contractId: 'contract-1',
        organizationId: ORG_ID,
        status: 'COMPLETED',
        createdAt: new Date(),
        recipients: [
          { id: 'r1', name: 'Signer A', email: 'a@test.com', status: 'SIGNED' },
          { id: 'r2', name: 'Signer B', email: 'b@test.com', status: 'SIGNED' },
        ],
        sentBy: { id: USER_ID, name: 'User' },
      },
      {
        id: 'env-list-2',
        contractId: 'contract-1',
        organizationId: ORG_ID,
        status: 'SENT',
        createdAt: new Date(),
        recipients: [
          { id: 'r3', name: 'Signer C', email: 'c@test.com', status: 'PENDING' },
          { id: 'r4', name: 'Signer D', email: 'd@test.com', status: 'SIGNED' },
        ],
        sentBy: { id: USER_ID, name: 'User' },
      },
    ]);

    const result = await tenantCaller.esign.listEnvelopes({ contractId: 'contract-1' });

    expect(result).toHaveLength(2);
    expect(result[0].recipientSummary).toEqual({ signed: 2, total: 2 });
    expect(result[1].recipientSummary).toEqual({ signed: 1, total: 2 });

    const findCall = mockPrisma.signingEnvelope.findMany.mock.calls[0][0];
    expect(findCall.where).toMatchObject({
      contractId: 'contract-1',
      organizationId: ORG_ID,
    });
  });

  it('returns empty array when no envelopes exist', async () => {
    mockPrisma.signingEnvelope.findMany.mockResolvedValue([]);

    const result = await tenantCaller.esign.listEnvelopes({ contractId: 'contract-none' });

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// getEnvelopeDetail — null case
// ===========================================================================

describe('esign.getEnvelopeDetail — not found', () => {
  it('returns null when envelope does not exist', async () => {
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue(null);

    const result = await tenantCaller.esign.getEnvelopeDetail({
      envelopeId: 'nonexistent',
    });

    expect(result).toBeNull();
  });
});

// ===========================================================================
// sendForSignature — with optional fields
// ===========================================================================

describe('esign.sendForSignature — optional fields', () => {
  it('passes contractId and message when provided', async () => {
    mockSendForSignature.mockResolvedValue({
      id: 'env-opt-1',
      status: 'SENT',
      contractId: 'contract-1',
    });

    await tenantCaller.esign.sendForSignature({
      contractId: 'contract-1',
      documentId: 'doc-1',
      connectionId: 'conn-1',
      provider: 'AUTENTI',
      signers: [{ name: 'Signer', email: 'signer@test.com', role: 'signer', routingOrder: 1 }],
      message: 'Please sign this contract',
      expiresInDays: 30,
      reminderIntervalDays: 7,
    });

    expect(mockSendForSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'contract-1',
        provider: 'AUTENTI',
        message: 'Please sign this contract',
        expiresInDays: 30,
        reminderIntervalDays: 7,
      }),
    );
  });
});

// ===========================================================================
// listPendingForContractor
// ===========================================================================

describe('esign.listPendingForContractor', () => {
  it('returns pending envelopes for contractor email', async () => {
    mockPrisma.signingRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        name: 'Signer',
        email: 'signer@test.com',
        status: 'PENDING',
        signingEnvelope: {
          id: 'env-pending-1',
          contractId: 'contract-1',
          status: 'SENT',
          message: 'Sign please',
          expiresAt: new Date('2026-01-01'),
          sentAt: new Date(),
          createdAt: new Date(),
        },
      },
    ]);

    const result = await portalCaller.esign.listPendingForContractor();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      envelopeId: 'env-pending-1',
      recipientEmail: 'signer@test.com',
      recipientStatus: 'PENDING',
      envelopeStatus: 'SENT',
    });
  });
});
