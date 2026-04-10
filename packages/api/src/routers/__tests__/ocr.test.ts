/**
 * OCR router tests.
 *
 * Tests the OCR extraction endpoints for both tenant and portal contexts.
 * trigger/portalTrigger delegate to the ocr-extraction service.
 * getResult/getByDocument/portalGetResult/portalGetByDocument test org scoping.
 * retrigger has inline Prisma logic for finding existing extraction and document.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "org-ocr-001";
const USER_ID = "user-ocr-001";
const CONTRACTOR_ID = "contractor-ocr-001";
const PORTAL_SESSION_TOKEN = "portal-session-token-ocr";

// ---------------------------------------------------------------------------
// Mock via vi.hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockTriggerOcr,
  mockGetExtractionResult,
  mockGetExtractionByDocument,
  mockQStashPublish,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    ocrExtraction: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockTriggerOcr: vi.fn(),
    mockGetExtractionResult: vi.fn(),
    mockGetExtractionByDocument: vi.fn(),
    mockQStashPublish: vi.fn(),
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

vi.mock("../../services/ocr-extraction.js", () => ({
  triggerOcrExtraction: mockTriggerOcr,
  processOcrExtraction: vi.fn(),
  getExtractionResult: mockGetExtractionResult,
  getExtractionByDocument: mockGetExtractionByDocument,
}));

vi.mock("@contractor-ops/integrations/services/qstash-client", () => ({
  getQStashClient: () => ({
    publishJSON: mockQStashPublish,
  }),
}));

vi.mock("../../services/portal-session.js", () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== PORTAL_SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      contractor: { id: CONTRACTOR_ID, email: "contractor@test.com" },
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

vi.mock("../../services/billing-service.js", () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
  getSubscription: vi.fn(async () => ({
    id: "sub_ocr_mock",
    status: "ACTIVE",
    tier: "PRO",
  })),
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
      id: "session-ocr",
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
      name: "OCR User",
      email: "ocr@test.com",
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
// trigger
// ===========================================================================

describe("ocr.trigger", () => {
  it("creates extraction record and returns extractionId", async () => {
    mockTriggerOcr.mockResolvedValue({ extractionId: "ext-1", remaining: 9 });

    const result = await tenantCaller.ocr.trigger({
      documentId: "doc-1",
      storageKey: "org/docs/file.pdf",
    });

    expect(result.extractionId).toBe("ext-1");
    expect(mockTriggerOcr).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        documentId: "doc-1",
        storageKey: "org/docs/file.pdf",
      }),
    );
  });

  it("throws PRECONDITION_FAILED when credits are exhausted", async () => {
    mockTriggerOcr.mockResolvedValue({ error: "credits_exhausted", remaining: 0 });

    await expect(
      tenantCaller.ocr.trigger({ documentId: "doc-1", storageKey: "key" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

// ===========================================================================
// getResult
// ===========================================================================

describe("ocr.getResult", () => {
  it("returns extraction data scoped to organization", async () => {
    const extractionData = {
      id: "ext-1",
      organizationId: ORG_ID,
      status: "COMPLETED",
      resultJson: { vendorName: "Test Vendor" },
    };
    mockGetExtractionResult.mockResolvedValue(extractionData);

    const result = await tenantCaller.ocr.getResult({ extractionId: "ext-1" });

    expect(result).toBeTruthy();
    expect(result!.status).toBe("COMPLETED");
    expect(mockGetExtractionResult).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      extractionId: "ext-1",
    });
  });

  it("returns null when extraction not found", async () => {
    mockGetExtractionResult.mockResolvedValue(null);

    const result = await tenantCaller.ocr.getResult({ extractionId: "nonexistent" });
    expect(result).toBeNull();
  });
});

// ===========================================================================
// getByDocument
// ===========================================================================

describe("ocr.getByDocument", () => {
  it("returns latest extraction for a document", async () => {
    mockGetExtractionByDocument.mockResolvedValue({
      id: "ext-latest",
      status: "COMPLETED",
    });

    const result = await tenantCaller.ocr.getByDocument({ documentId: "doc-1" });

    expect(result!.id).toBe("ext-latest");
    expect(mockGetExtractionByDocument).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      documentId: "doc-1",
    });
  });
});

// ===========================================================================
// retrigger
// ===========================================================================

describe("ocr.retrigger", () => {
  it("creates new extraction record for same document", async () => {
    mockPrisma.ocrExtraction.findFirst.mockResolvedValue({
      id: "ext-old",
      organizationId: ORG_ID,
      documentId: "doc-retrigger",
      invoiceId: "inv-1",
    });

    mockPrisma.document.findFirst.mockResolvedValue({
      storageKey: "org/docs/retrigger.pdf",
    });

    mockPrisma.ocrExtraction.create.mockResolvedValue({
      id: "ext-new",
    });

    mockQStashPublish.mockResolvedValue({});

    const result = await tenantCaller.ocr.retrigger({ extractionId: "ext-old" });

    expect(result.extractionId).toBe("ext-new");

    // Verify the new extraction inherits documentId and invoiceId
    const createCall = mockPrisma.ocrExtraction.create.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      organizationId: ORG_ID,
      documentId: "doc-retrigger",
      invoiceId: "inv-1",
      provider: "CLAUDE",
      status: "PENDING",
    });

    // Verify QStash job was dispatched
    expect(mockQStashPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          extractionId: "ext-new",
          organizationId: ORG_ID,
          storageKey: "org/docs/retrigger.pdf",
        }),
      }),
    );
  });

  it("throws when extraction not found (org-scoped)", async () => {
    mockPrisma.ocrExtraction.findFirst.mockResolvedValue(null);

    await expect(
      tenantCaller.ocr.retrigger({ extractionId: "nonexistent" }),
    ).rejects.toThrow("Extraction not found");
  });
});

// ===========================================================================
// Portal endpoints
// ===========================================================================

describe("ocr.portalTrigger", () => {
  it("creates extraction using portal session organizationId", async () => {
    mockTriggerOcr.mockResolvedValue({ extractionId: "ext-portal", remaining: 5 });

    const result = await portalCaller.ocr.portalTrigger({
      documentId: "doc-portal",
      storageKey: "org/portal/file.pdf",
    });

    expect(result.extractionId).toBe("ext-portal");
    expect(mockTriggerOcr).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        documentId: "doc-portal",
      }),
    );
  });
});

describe("ocr.portalGetResult", () => {
  it("returns extraction scoped to portal organization", async () => {
    mockGetExtractionResult.mockResolvedValue({
      id: "ext-portal-result",
      status: "COMPLETED",
    });

    const result = await portalCaller.ocr.portalGetResult({
      extractionId: "ext-portal-result",
    });

    expect(result!.id).toBe("ext-portal-result");
    expect(mockGetExtractionResult).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      extractionId: "ext-portal-result",
    });
  });

  describe("tier gating", () => {
    it("trigger and retrigger include requireTier(PRO)", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sourceDir = path.resolve(import.meta.dirname, "../../routers");
      const source = fs.readFileSync(
        path.join(sourceDir, "ocr.ts"),
        "utf-8",
      );

      expect(source).toContain('import { requireTier } from "../middleware/tier.js"');
      expect(source).toContain('requireTier("PRO")');

      const matches = source.match(/\.use\(requireTier\("PRO"\)\)/g);
      expect(matches).toHaveLength(2);
    });

    it("read-only procedures do NOT include requireTier", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sourceDir = path.resolve(import.meta.dirname, "../../routers");
      const source = fs.readFileSync(
        path.join(sourceDir, "ocr.ts"),
        "utf-8",
      );

      for (const proc of ["getResult", "getByDocument"]) {
        const procRegex = new RegExp(`${proc}:\\s*tenantProcedure[\\s\\S]*?(?=\\w+:\\s*tenantProcedure|\\}\\);$)`, "m");
        const match = source.match(procRegex);
        if (match) {
          expect(match[0]).not.toContain("requireTier");
        }
      }
    });
  });
});
