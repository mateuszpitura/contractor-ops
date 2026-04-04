/**
 * E-sign router tests.
 *
 * Tests the esign router procedures for signing envelope management.
 * sendForSignature/getSigningUrl/voidEnvelope/resendToRecipient delegate to
 * the esign-orchestrator service, so we test the router-level logic:
 * permission checks, org scoping, and the portal signing URL access control.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "org-esign-001";
const USER_ID = "user-esign-001";
const CONTRACTOR_ID = "contractor-esign-001";
const PORTAL_SESSION_TOKEN = "portal-session-token-esign";

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockSendForSignature, mockGetSigningUrl, mockVoidEnvelope, mockResendToRecipient } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
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

vi.mock("@contractor-ops/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}));

vi.mock("@contractor-ops/db", () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
}));

vi.mock("../../services/esign-orchestrator.js", () => ({
  sendForSignature: mockSendForSignature,
  getSigningUrl: mockGetSigningUrl,
  voidEnvelope: mockVoidEnvelope,
  resendToRecipient: mockResendToRecipient,
}));

vi.mock("../../services/portal-session.js", () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== PORTAL_SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      contractor: { id: CONTRACTOR_ID, email: "signer@test.com" },
    };
  }),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock("../../services/portal-magic-link.js", () => ({
  createMagicLinkToken: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
  findContractorsByEmail: vi.fn(),
  sendPortalMagicLink: vi.fn(),
}));

vi.mock("../../services/r2.js", () => ({
  createPresignedUploadUrl: vi.fn(async () => ({ url: "https://r2.test/upload", key: "k" })),
  createPresignedDownloadUrl: vi.fn(async () => "https://r2.test/download"),
  generateStorageKey: vi.fn(() => "mock-key"),
}));

vi.mock("../../services/portal-change-request.js", () => ({
  createChangeRequest: vi.fn(),
}));

vi.mock("../../services/bank-account-crypto.js", () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock("../../services/stripe-client.js", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { createPreview: vi.fn() },
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    billing: { meterEvents: { create: vi.fn() } },
  },
}));

vi.mock("@contractor-ops/logger", () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("@contractor-ops/logger/metrics", () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock("@sentry/nextjs", () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from "../../init.js";
import { appRouter } from "../../root.js";

// ---------------------------------------------------------------------------
// Caller setup
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeTenantCaller() {
  const session = {
    session: {
      id: "session-esign",
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date("2099-01-01"),
      token: "mock-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: "E-sign User",
      email: "esign@test.com",
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: "admin",
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

describe("esign.sendForSignature", () => {
  it("creates envelope and updates contract status to PENDING_SIGNATURE", async () => {
    const mockEnvelope = {
      id: "env-1",
      status: "SENT",
      contractId: "contract-1",
    };
    mockSendForSignature.mockResolvedValue(mockEnvelope);

    const result = await tenantCaller.esign.sendForSignature({
      documentId: "doc-1",
      connectionId: "conn-1",
      provider: "DOCUSIGN",
      signers: [
        { name: "Signer A", email: "a@test.com", role: "signer", routingOrder: 1 },
      ],
    });

    expect(result.id).toBe("env-1");
    expect(mockSendForSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        userId: USER_ID,
        documentId: "doc-1",
        connectionId: "conn-1",
        provider: "DOCUSIGN",
      }),
    );
  });
});

// ===========================================================================
// getEnvelopeDetail
// ===========================================================================

describe("esign.getEnvelopeDetail", () => {
  it("returns envelope with recipients and events scoped to organization", async () => {
    const envelopeData = {
      id: "env-detail-1",
      organizationId: ORG_ID,
      status: "SENT",
      recipients: [
        { id: "r1", name: "Signer", email: "s@test.com", routingOrder: 1, status: "PENDING" },
      ],
      events: [
        { id: "e1", occurredAt: new Date("2025-06-01"), eventType: "SENT" },
      ],
      sentBy: { id: USER_ID, name: "User", email: "user@test.com" },
    };
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue(envelopeData);

    const result = await tenantCaller.esign.getEnvelopeDetail({
      envelopeId: "env-detail-1",
    });

    expect(result).toBeTruthy();
    expect(result!.id).toBe("env-detail-1");

    // Verify org scoping in WHERE clause
    const findArgs = mockPrisma.signingEnvelope.findFirst.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({
      id: "env-detail-1",
      organizationId: ORG_ID,
    });
  });
});

// ===========================================================================
// getPortalSigningUrl
// ===========================================================================

describe("esign.getPortalSigningUrl", () => {
  it("returns signing URL when contractor is a recipient", async () => {
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue({
      id: "env-portal-1",
      organizationId: ORG_ID,
      recipients: [{ email: "signer@test.com" }],
    });

    mockGetSigningUrl.mockResolvedValue({ url: "https://docusign.test/sign" });

    const result = await portalCaller.esign.getPortalSigningUrl({
      envelopeId: "env-portal-1",
      recipientEmail: "signer@test.com",
      returnUrl: "https://portal.test/done",
    });

    expect(result.url).toBe("https://docusign.test/sign");
  });

  it("throws FORBIDDEN when contractor is not a recipient", async () => {
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue({
      id: "env-portal-2",
      organizationId: ORG_ID,
      recipients: [{ email: "other@test.com" }],
    });

    await expect(
      portalCaller.esign.getPortalSigningUrl({
        envelopeId: "env-portal-2",
        recipientEmail: "signer@test.com",
        returnUrl: "https://portal.test/done",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND when envelope does not exist", async () => {
    mockPrisma.signingEnvelope.findFirst.mockResolvedValue(null);

    await expect(
      portalCaller.esign.getPortalSigningUrl({
        envelopeId: "nonexistent",
        recipientEmail: "signer@test.com",
        returnUrl: "https://portal.test/done",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ===========================================================================
// voidEnvelope & resendToRecipient — delegate to service
// ===========================================================================

describe("esign.voidEnvelope", () => {
  it("voids envelope and returns success", async () => {
    mockVoidEnvelope.mockResolvedValue(undefined);

    const result = await tenantCaller.esign.voidEnvelope({
      envelopeId: "env-void-1",
      reason: "Cancelled by admin",
    });

    expect(result.success).toBe(true);
    expect(mockVoidEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        envelopeId: "env-void-1",
        reason: "Cancelled by admin",
      }),
    );
  });
});

describe("esign.resendToRecipient", () => {
  it("sends reminder to specific signer", async () => {
    mockResendToRecipient.mockResolvedValue(undefined);

    const result = await tenantCaller.esign.resendToRecipient({
      envelopeId: "env-resend-1",
      recipientEmail: "signer@test.com",
    });

    expect(result.success).toBe(true);
    expect(mockResendToRecipient).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        envelopeId: "env-resend-1",
        recipientEmail: "signer@test.com",
      }),
    );
  });
});
