/**
 * Portal router — public auth (magic link) + session-bound logout (portalProcedure).
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG_ID = "org-portal-main-001";
const ORG_ID_2 = "org-portal-main-002";
const CONTRACTOR_ID = "contractor-portal-main-001";
const CONTRACT_ID = "clcontract000000000000099";
const INV_ID = "clinv000000000000099";
const EMAIL = "contractor@example.com";
const SESSION_TOKEN = "portal-session-token-main";

const { mockCreateChangeRequest, mockEncryptBankAccount } = vi.hoisted(() => ({
  mockCreateChangeRequest: vi.fn(),
  mockEncryptBankAccount: vi.fn((s: string) => `enc:${s}`),
}));

const {
  mockPrisma,
  mockFindContractorsByEmail,
  mockCreateMagicLinkToken,
  mockVerifyMagicLinkToken,
  mockSendPortalMagicLink,
  mockValidatePortalSession,
  mockCreatePortalSession,
  mockDeletePortalSession,
  mockCreatePresignedDownloadUrl,
  mockCreatePresignedUploadUrl,
  mockGenerateStorageKey,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockFindContractorsByEmail = vi.fn();
  const mockCreateMagicLinkToken = vi.fn();
  const mockVerifyMagicLinkToken = vi.fn();
  const mockSendPortalMagicLink = vi.fn();
  const mockValidatePortalSession = vi.fn();
  const mockCreatePortalSession = vi.fn();
  const mockDeletePortalSession = vi.fn();
  const mockCreatePresignedDownloadUrl = vi.fn(async () => "https://signed.example/doc");
  const mockCreatePresignedUploadUrl = vi.fn(async () => "https://upload.example/put");
  const mockGenerateStorageKey = vi.fn(() => "org/org-1/doc/x.pdf");

  const mockPrisma: Rec = {
    contractor: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    contract: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    invoice: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    document: {
      create: vi.fn(),
    },
    documentLink: {
      findMany: vi.fn(),
    },
    invoiceFile: {
      create: vi.fn(),
    },
    paymentRunItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    contractorBillingProfile: {
      findFirst: vi.fn(),
    },
    contractorChangeRequest: {
      findFirst: vi.fn(),
    },
    contractorNotificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };

  return {
    mockPrisma,
    mockFindContractorsByEmail,
    mockCreateMagicLinkToken,
    mockVerifyMagicLinkToken,
    mockSendPortalMagicLink,
    mockValidatePortalSession,
    mockCreatePortalSession,
    mockDeletePortalSession,
    mockCreatePresignedDownloadUrl,
    mockCreatePresignedUploadUrl,
    mockGenerateStorageKey,
  };
});

vi.mock("../../services/portal-magic-link.js", () => ({
  findContractorsByEmail: mockFindContractorsByEmail,
  createMagicLinkToken: mockCreateMagicLinkToken,
  verifyMagicLinkToken: mockVerifyMagicLinkToken,
  sendPortalMagicLink: mockSendPortalMagicLink,
}));

vi.mock("../../services/portal-session.js", () => ({
  validatePortalSession: mockValidatePortalSession,
  createPortalSession: mockCreatePortalSession,
  deletePortalSession: mockDeletePortalSession,
}));

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
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
}));

vi.mock("@sentry/nextjs", () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock("@contractor-ops/logger", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock("@contractor-ops/logger/metrics", () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock("../../services/r2.js", () => ({
  createPresignedDownloadUrl: mockCreatePresignedDownloadUrl,
  createPresignedUploadUrl: mockCreatePresignedUploadUrl,
  generateStorageKey: mockGenerateStorageKey,
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

vi.mock("../../services/portal-change-request.js", () => ({
  createChangeRequest: (...args: unknown[]) => mockCreateChangeRequest(...args),
}));

vi.mock("../../services/bank-account-crypto.js", () => ({
  encryptBankAccount: (s: string) => mockEncryptBankAccount(s),
}));

import { createCallerFactory } from "../../init.js";
import { portalRouter } from "../portal.js";

const createCaller = createCallerFactory(portalRouter);

function publicCaller(headers?: Headers) {
  return createCaller({
    headers: headers ?? new Headers({ origin: "https://portal.example.com" }),
    session: null as never,
    user: null as never,
  });
}

function authedPortalCaller() {
  return createCaller({
    headers: new Headers({
      origin: "https://portal.example.com",
      cookie: `portal_session=${SESSION_TOKEN}`,
    }),
    session: null as never,
    user: null as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindContractorsByEmail.mockResolvedValue([]);
  mockCreateMagicLinkToken.mockResolvedValue({
    token: "signed-token",
    expiresAt: new Date("2099-01-01"),
  });
  mockVerifyMagicLinkToken.mockResolvedValue(null);
  mockSendPortalMagicLink.mockResolvedValue(undefined);
  mockValidatePortalSession.mockImplementation(async (token: string) => {
    if (token !== SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      email: EMAIL,
      contractor: {
        id: CONTRACTOR_ID,
        email: EMAIL,
        displayName: "Portal Contractor",
      },
    };
  });
  mockCreatePortalSession.mockResolvedValue({
    rawToken: "new-session-token",
    expiresAt: new Date("2099-06-01"),
  });
  mockDeletePortalSession.mockResolvedValue(undefined);
  mockPrisma.contractor.findFirst.mockResolvedValue(null);
  mockPrisma.contractor.findUnique.mockResolvedValue(null);
  mockPrisma.contractor.update.mockResolvedValue({});
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: ORG_ID,
    name: "Acme Corp",
    logo: null,
  });
  mockPrisma.contract.count.mockResolvedValue(0);
  mockPrisma.contract.findFirst.mockResolvedValue(null);
  mockPrisma.contract.findMany.mockResolvedValue([]);
  mockPrisma.invoice.count.mockResolvedValue(0);
  mockPrisma.invoice.findMany.mockResolvedValue([]);
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
  mockPrisma.documentLink.findMany.mockResolvedValue([]);
  mockPrisma.paymentRunItem.findFirst.mockResolvedValue(null);
  mockPrisma.paymentRunItem.findMany.mockResolvedValue([]);
  mockPrisma.document.create.mockResolvedValue({});
  mockPrisma.invoice.create.mockResolvedValue({});
  mockPrisma.invoiceFile.create.mockResolvedValue({});
  mockPrisma.contractorBillingProfile.findFirst.mockResolvedValue(null);
  mockPrisma.contractorChangeRequest.findFirst.mockResolvedValue(null);
  mockPrisma.contractorNotificationPreference.findMany.mockResolvedValue([]);
  mockPrisma.contractorNotificationPreference.upsert.mockResolvedValue({
    category: "INVOICE_UPDATES",
    emailEnabled: true,
  });
  mockCreatePresignedDownloadUrl.mockImplementation(async () => "https://signed.example/doc");
  mockCreatePresignedUploadUrl.mockResolvedValue("https://upload.example/put");
  mockGenerateStorageKey.mockReturnValue("org/org-1/doc/x.pdf");
  mockCreateChangeRequest.mockResolvedValue({
    id: "cr-1",
    status: "PENDING",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
  });
  mockEncryptBankAccount.mockImplementation((s: string) => `enc:${s}`);
});

describe("portal router — requestMagicLink", () => {
  it("returns success without emailing when no contractors match (anti-enumeration)", async () => {
    const out = await publicCaller().requestMagicLink({ email: EMAIL });

    expect(out).toEqual({ success: true });
    expect(mockCreateMagicLinkToken).not.toHaveBeenCalled();
    expect(mockSendPortalMagicLink).not.toHaveBeenCalled();
  });

  it("creates token and sends email when contractors exist", async () => {
    mockFindContractorsByEmail.mockResolvedValueOnce([
      { id: CONTRACTOR_ID, organizationId: ORG_ID },
    ]);

    const out = await publicCaller().requestMagicLink({ email: EMAIL });

    expect(out).toEqual({ success: true });
    expect(mockCreateMagicLinkToken).toHaveBeenCalledWith(EMAIL);
    expect(mockSendPortalMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        email: EMAIL,
        token: "signed-token",
        baseUrl: "https://portal.example.com",
      }),
    );
  });
});

describe("portal router — verifyMagicLink", () => {
  it("throws BAD_REQUEST when token cannot be verified", async () => {
    await expect(publicCaller().verifyMagicLink({ token: "bad" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("throws NOT_FOUND when email has no contractors", async () => {
    mockVerifyMagicLinkToken.mockResolvedValueOnce({ email: EMAIL });

    await expect(publicCaller().verifyMagicLink({ token: "ok" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("creates session for single-org contractor", async () => {
    mockVerifyMagicLinkToken.mockResolvedValueOnce({ email: EMAIL });
    mockFindContractorsByEmail.mockResolvedValueOnce([
      {
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        organization: { name: "Acme", logo: null },
      },
    ]);

    const out = await publicCaller().verifyMagicLink({ token: "ok" });

    expect(mockCreatePortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        contractorId: CONTRACTOR_ID,
        organizationId: ORG_ID,
        email: EMAIL,
      }),
    );
    expect(out).toMatchObject({
      needsOrgPicker: false,
      session: { rawToken: "new-session-token" },
      orgs: null,
    });
  });

  it("returns org picker payload for multi-org email", async () => {
    mockVerifyMagicLinkToken.mockResolvedValueOnce({ email: EMAIL });
    mockFindContractorsByEmail.mockResolvedValueOnce([
      {
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        organization: { name: "A", logo: null },
      },
      {
        id: "c2",
        organizationId: ORG_ID_2,
        organization: { name: "B", logo: "logo.png" },
      },
    ]);

    const out = await publicCaller().verifyMagicLink({ token: "ok" });

    expect(mockCreatePortalSession).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      needsOrgPicker: true,
      session: null,
      email: EMAIL,
      verificationNonce: "signed-token",
    });
    expect((out as { orgs: unknown[] }).orgs).toHaveLength(2);
  });
});

describe("portal router — selectOrg", () => {
  it("throws UNAUTHORIZED when verification nonce is invalid", async () => {
    await expect(
      publicCaller().selectOrg({
        verificationNonce: "bad",
        contractorId: CONTRACTOR_ID,
        organizationId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws NOT_FOUND when contractor does not match verified email", async () => {
    mockVerifyMagicLinkToken.mockResolvedValueOnce({ email: EMAIL });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce(null);

    await expect(
      publicCaller().selectOrg({
        verificationNonce: "nonce",
        contractorId: CONTRACTOR_ID,
        organizationId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates session when contractor matches", async () => {
    mockVerifyMagicLinkToken.mockResolvedValueOnce({ email: EMAIL });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      organizationId: ORG_ID,
      email: EMAIL,
    });

    const out = await publicCaller().selectOrg({
      verificationNonce: "nonce",
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
    });

    expect(mockCreatePortalSession).toHaveBeenCalled();
    expect(out).toMatchObject({ rawToken: "new-session-token" });
  });
});

describe("portal router — logout", () => {
  it("deletes portal session when cookie present", async () => {
    await authedPortalCaller().logout();

    expect(mockDeletePortalSession).toHaveBeenCalledWith(SESSION_TOKEN);
  });
});

describe("portal router — getSession + overview", () => {
  it("getSession merges contractor with organization name and logo", async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: ORG_ID,
      name: "Northwind",
      logo: "https://cdn.example/logo.png",
    });

    const out = await authedPortalCaller().getSession();

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      select: { id: true, name: true, logo: true },
    });
    expect(out).toEqual({
      contractor: {
        id: CONTRACTOR_ID,
        displayName: "Portal Contractor",
        email: EMAIL,
      },
      organization: {
        id: ORG_ID,
        name: "Northwind",
        logo: "https://cdn.example/logo.png",
      },
    });
  });

  it("overview aggregates contract and invoice counts for the portal contractor", async () => {
    mockPrisma.contract.count.mockResolvedValueOnce(2);
    mockPrisma.invoice.count.mockResolvedValueOnce(5);
    mockPrisma.invoice.findMany.mockResolvedValueOnce([{ totalMinor: 10_000, currency: "PLN" }]);
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      dueDate: new Date("2026-12-01"),
    });
    mockPrisma.contract.findFirst.mockResolvedValueOnce(null);
    mockPrisma.invoice.findMany.mockResolvedValueOnce([]);

    const out = await authedPortalCaller().overview();

    expect(mockPrisma.contract.count).toHaveBeenCalledWith({
      where: {
        contractorId: CONTRACTOR_ID,
        status: { in: ["ACTIVE", "EXPIRING"] },
      },
    });
    expect(out.activeContracts).toBe(2);
    expect(out.pendingInvoices).toBe(5);
    expect(out.recentPaymentsMinor).toBe(10_000);
    expect(out.recentPaymentsCurrency).toBe("PLN");
    expect(out.upcomingDeadline).toBe("2026-12-01T00:00:00.000Z");
    expect(out.recentActivity).toEqual([]);
  });
});

describe("portal router — contracts + invoices", () => {
  it("listContracts scopes to contractor and allowed statuses", async () => {
    mockPrisma.contract.findMany.mockResolvedValueOnce([
      { id: CONTRACT_ID, title: "MSA", status: "ACTIVE" },
    ]);

    const rows = await authedPortalCaller().listContracts();

    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith({
      where: {
        contractorId: CONTRACTOR_ID,
        status: { in: ["ACTIVE", "EXPIRING", "EXPIRED"] },
      },
      select: {
        id: true,
        contractNumber: true,
        title: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        currency: true,
        billingModel: true,
        rateType: true,
        rateValueMinor: true,
      },
      orderBy: { startDate: "desc" },
    });
    expect(rows).toHaveLength(1);
  });

  it("getActiveContracts returns only ACTIVE contracts for dropdown", async () => {
    mockPrisma.contract.findMany.mockResolvedValueOnce([
      {
        id: CONTRACT_ID,
        title: "MSA",
        currency: "PLN",
        rateValueMinor: 10000,
        rateType: "HOURLY",
        billingModel: "TIME_AND_MATERIALS",
      },
    ]);

    const rows = await authedPortalCaller().getActiveContracts();

    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith({
      where: { contractorId: CONTRACTOR_ID, status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        currency: true,
        rateValueMinor: true,
        rateType: true,
        billingModel: true,
      },
    });
    expect(rows).toHaveLength(1);
  });

  it("getContract throws NOT_FOUND when contract is not scoped to contractor", async () => {
    mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(authedPortalCaller().getContract({ id: CONTRACT_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getContract returns contract with empty documents when no links", async () => {
    mockPrisma.contract.findFirst.mockResolvedValueOnce({
      id: CONTRACT_ID,
      contractNumber: "C-2024-01",
      title: "MSA",
      type: "MSA",
      status: "ACTIVE",
      startDate: new Date("2024-01-01"),
      endDate: null,
      currency: "PLN",
      billingModel: "TIME_AND_MATERIALS",
      rateType: "HOURLY",
      rateValueMinor: 10000,
      paymentTermsDays: 30,
      autoRenewal: false,
      noticePeriodDays: 30,
      ratePeriods: [],
    });
    mockPrisma.documentLink.findMany.mockResolvedValueOnce([]);

    const out = await authedPortalCaller().getContract({ id: CONTRACT_ID });

    expect(out.documents).toEqual([]);
    expect(mockCreatePresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("listInvoices orders by receivedAt desc for contractor", async () => {
    mockPrisma.invoice.findMany.mockResolvedValueOnce([
      {
        id: INV_ID,
        invoiceNumber: "INV-1",
        contractId: CONTRACT_ID,
        totalMinor: 5000,
        currency: "PLN",
        issueDate: null,
        receivedAt: new Date("2026-03-01"),
        status: "RECEIVED",
        matchStatus: "MATCHED",
        approvalStatus: null,
        paymentStatus: "PENDING",
        paidAt: null,
        contract: { title: "MSA" },
      },
    ]);

    const rows = await authedPortalCaller().listInvoices();

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
      where: { contractorId: CONTRACTOR_ID, deletedAt: null },
      select: expect.any(Object),
      orderBy: { receivedAt: "desc" },
    });
    expect(rows).toHaveLength(1);
  });

  it("getInvoice throws NOT_FOUND when invoice is missing", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

    await expect(authedPortalCaller().getInvoice({ id: INV_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getInvoice returns files, payment, and activity log", async () => {
    const receivedAt = new Date("2026-02-15T10:00:00.000Z");
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: INV_ID,
      invoiceNumber: "INV-99",
      issueDate: null,
      dueDate: null,
      subtotalMinor: 4000,
      totalMinor: 5000,
      currency: "PLN",
      status: "RECEIVED",
      approvalStatus: null,
      paymentStatus: "PENDING",
      receivedAt,
      reviewedAt: null,
      approvedAt: null,
      paidAt: null,
      rejectedAt: null,
      rejectionReason: null,
      contract: { id: CONTRACT_ID, title: "MSA" },
      files: [],
    });
    mockPrisma.paymentRunItem.findFirst.mockResolvedValueOnce(null);

    const out = await authedPortalCaller().getInvoice({ id: INV_ID });

    expect(out.files).toEqual([]);
    expect(out.payment).toBeNull();
    expect(out.activityLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "Invoice submitted",
        }),
      ]),
    );
    expect((out.activityLog[0] as { timestamp: string }).timestamp).toBe(
      "2026-02-15T10:00:00.000Z",
    );
  });
});

describe("portal router — documents, payments, uploads", () => {
  it("listDocuments dedupes contractor-linked files and presigns downloads", async () => {
    const created = new Date("2026-01-10T12:00:00.000Z");
    mockPrisma.documentLink.findMany.mockResolvedValueOnce([
      {
        document: {
          id: "doc-1",
          originalFileName: "stmt.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 2048,
          documentType: "OTHER",
          createdAt: created,
          storageKey: "r2/key-1",
        },
      },
    ]);
    mockPrisma.contract.findMany.mockResolvedValueOnce([]);

    const rows = await authedPortalCaller().listDocuments();

    expect(rows).toHaveLength(1);
    expect(mockCreatePresignedDownloadUrl).toHaveBeenCalledWith("r2/key-1");
    expect(rows[0]).toMatchObject({
      id: "doc-1",
      name: "stmt.pdf",
      downloadUrl: "https://signed.example/doc",
    });
  });

  it("listPayments maps paid items without batch ids", async () => {
    mockPrisma.paymentRunItem.findMany.mockResolvedValueOnce([
      {
        id: "pri-1",
        invoiceId: INV_ID,
        amountMinor: 99_00,
        currency: "PLN",
        markedPaidAt: new Date("2026-03-01"),
        invoice: { invoiceNumber: "INV-P1" },
      },
    ]);

    const rows = await authedPortalCaller().listPayments();

    expect(mockPrisma.paymentRunItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contractorId: CONTRACTOR_ID, status: "PAID" },
        orderBy: { markedPaidAt: "desc" },
      }),
    );
    expect(rows[0]).toMatchObject({
      invoiceNumber: "INV-P1",
      amountMinor: 99_00,
      currency: "PLN",
    });
  });

  it("getUploadUrl returns presigned PUT and storage key", async () => {
    const out = await authedPortalCaller().getUploadUrl({
      filename: "invoice.pdf",
      contentType: "application/pdf",
    });

    expect(mockGenerateStorageKey).toHaveBeenCalled();
    expect(mockCreatePresignedUploadUrl).toHaveBeenCalledWith(
      "org/org-1/doc/x.pdf",
      "application/pdf",
    );
    expect(out).toMatchObject({
      uploadUrl: "https://upload.example/put",
      documentId: "00000000-0000-4000-8000-000000000001",
      storageKey: "org/org-1/doc/x.pdf",
    });
  });

  it("getUploadUrl rejects non-PDF content type", async () => {
    await expect(
      authedPortalCaller().getUploadUrl({
        filename: "x.pdf",
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("submitInvoice creates document, invoice, and file link when contract is ACTIVE", async () => {
    mockPrisma.contract.findFirst.mockResolvedValueOnce({
      id: CONTRACT_ID,
      currency: "PLN",
    });
    mockPrisma.document.create.mockResolvedValueOnce({});
    mockPrisma.invoice.create.mockResolvedValueOnce({
      id: "inv-new-1",
      invoiceNumber: "INV-PORT-1",
      status: "RECEIVED",
    });
    mockPrisma.invoiceFile.create.mockResolvedValueOnce({});

    const out = await authedPortalCaller().submitInvoice({
      contractId: CONTRACT_ID,
      invoiceNumber: "INV-PORT-1",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-30"),
      netAmountMinor: 800_00,
      grossAmountMinor: 984_00,
      documentId: "00000000-0000-4000-8000-000000000001",
      storageKey: "org/org-1/doc/x.pdf",
      originalFileName: "invoice.pdf",
      fileSizeBytes: 5000,
    });

    expect(mockPrisma.document.create).toHaveBeenCalled();
    expect(mockPrisma.invoice.create).toHaveBeenCalled();
    expect(mockPrisma.invoiceFile.create).toHaveBeenCalled();
    expect(out).toMatchObject({
      invoiceId: "inv-new-1",
      invoiceNumber: "INV-PORT-1",
      status: "RECEIVED",
    });
  });

  it("submitInvoice throws NOT_FOUND when contract is not active for contractor", async () => {
    mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      authedPortalCaller().submitInvoice({
        contractId: CONTRACT_ID,
        invoiceNumber: "INV-X",
        issueDate: new Date("2026-04-01"),
        dueDate: new Date("2026-04-30"),
        netAmountMinor: 100,
        grossAmountMinor: 123,
        documentId: "doc-1",
        storageKey: "k",
        originalFileName: "a.pdf",
        fileSizeBytes: 100,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("portal router — profile + notifications", () => {
  it("getProfile returns contractor, billing profile, and pending change request", async () => {
    mockPrisma.contractor.findUnique.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      displayName: "Portal Contractor",
      email: EMAIL,
      phone: "+48123",
      addressLine1: "ul. Test 1",
      addressLine2: null,
      city: "WAW",
      postalCode: "00-001",
      countryCode: "PL",
      taxId: "1234567890",
    });
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValueOnce({
      id: "bp-1",
      bankAccountMasked: "****42",
      bankName: "BK",
      swiftBic: "ABCDEFGH",
      taxId: "123",
    });
    mockPrisma.contractorChangeRequest.findFirst.mockResolvedValueOnce(null);

    const out = await authedPortalCaller().getProfile();

    expect(out.displayName).toBe("Portal Contractor");
    expect(out.billingProfile).toMatchObject({ bankName: "BK" });
    expect(out.pendingChangeRequest).toBeNull();
  });

  it("getProfile throws NOT_FOUND when contractor row is missing", async () => {
    mockPrisma.contractor.findUnique.mockResolvedValueOnce(null);

    await expect(authedPortalCaller().getProfile()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getNotificationPreferences fills defaults for all five categories", async () => {
    mockPrisma.contractorNotificationPreference.findMany.mockResolvedValueOnce([
      { category: "INVOICE_UPDATES", emailEnabled: false },
    ]);

    const prefs = await authedPortalCaller().getNotificationPreferences();

    expect(prefs).toHaveLength(5);
    const inv = prefs.find((p) => p.category === "INVOICE_UPDATES");
    expect(inv?.emailEnabled).toBe(false);
    const sec = prefs.find((p) => p.category === "SECURITY_ALERTS");
    expect(sec?.emailEnabled).toBe(true);
  });

  it("updateNotificationPreference upserts and returns row", async () => {
    mockPrisma.contractorNotificationPreference.upsert.mockResolvedValueOnce({
      category: "PAYMENT_CONFIRMATIONS",
      emailEnabled: false,
    });

    const out = await authedPortalCaller().updateNotificationPreference({
      category: "PAYMENT_CONFIRMATIONS",
      emailEnabled: false,
    });

    expect(mockPrisma.contractorNotificationPreference.upsert).toHaveBeenCalled();
    expect(out).toEqual({ category: "PAYMENT_CONFIRMATIONS", emailEnabled: false });
  });

  it("updateNotificationPreference forbids disabling SECURITY_ALERTS", async () => {
    await expect(
      authedPortalCaller().updateNotificationPreference({
        category: "SECURITY_ALERTS",
        emailEnabled: false,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockPrisma.contractorNotificationPreference.upsert).not.toHaveBeenCalled();
  });

  it("updateContactInfo updates contractor contact fields", async () => {
    mockPrisma.contractor.update.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      displayName: "Updated Name",
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: null,
    });

    const out = await authedPortalCaller().updateContactInfo({
      displayName: "Updated Name",
    });

    expect(mockPrisma.contractor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTRACTOR_ID },
        data: expect.objectContaining({ displayName: "Updated Name" }),
      }),
    );
    expect(out.displayName).toBe("Updated Name");
  });
});

describe("portal router — submitFinancialChangeRequest", () => {
  it("throws BAD_REQUEST when no financial fields are provided", async () => {
    await expect(authedPortalCaller().submitFinancialChangeRequest({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockCreateChangeRequest).not.toHaveBeenCalled();
  });

  it("creates change request with bankName and snapshots previous billing profile", async () => {
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValueOnce({
      bankAccountMasked: "****99",
      bankName: "Old Bank",
      swiftBic: "OLDXXXX",
      taxId: "5260000000",
    });

    const out = await authedPortalCaller().submitFinancialChangeRequest({
      bankName: "New Bank Ltd",
    });

    expect(mockCreateChangeRequest).toHaveBeenCalledWith(
      CONTRACTOR_ID,
      ORG_ID,
      { bankName: "New Bank Ltd" },
      {
        bankAccountMasked: "****99",
        bankName: "Old Bank",
        swiftBic: "OLDXXXX",
        taxId: "5260000000",
      },
    );
    expect(out.id).toBe("cr-1");
    expect(out.status).toBe("PENDING");
    expect(out.createdAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("encrypts bank account, masks last four, and passes to createChangeRequest", async () => {
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValueOnce(null);

    await authedPortalCaller().submitFinancialChangeRequest({
      bankAccountNumber: "12 3456 7890 1234",
    });

    expect(mockEncryptBankAccount).toHaveBeenCalledWith("12345678901234");
    expect(mockCreateChangeRequest).toHaveBeenCalledWith(
      CONTRACTOR_ID,
      ORG_ID,
      expect.objectContaining({
        bankAccountEncrypted: "enc:12345678901234",
        bankAccountMasked: "****1234",
      }),
      expect.any(Object),
    );
  });

  it("propagates CONFLICT when a pending change request already exists", async () => {
    mockPrisma.contractorBillingProfile.findFirst.mockResolvedValueOnce(null);
    mockCreateChangeRequest.mockRejectedValueOnce(
      new TRPCError({ code: "CONFLICT", message: "PORTAL_PENDING_CHANGE_EXISTS" }),
    );

    await expect(
      authedPortalCaller().submitFinancialChangeRequest({ taxId: "7777777777" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
