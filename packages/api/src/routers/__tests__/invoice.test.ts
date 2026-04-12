/**
 * Invoice router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, service modules, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test configures mock return values, calls the procedure,
 *    then asserts the arguments passed to Prisma (WHERE clauses, data).
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
const USER_ID = "clyyyyyyyyyyyyyyyyyyyyyyyy";
const INVOICE_ID = "clinvoice00000000000000001";
const DOC_ID_1 = "cldocument0000000000000001";
const DOC_ID_2 = "cldocument0000000000000002";
const CONTRACTOR_ID = "clcontractor000000000001";
const CONTRACT_ID = "clcontract0000000000000001";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    invoice: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: INVOICE_ID,
        invoiceNumber: "FV/2025/001",
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    invoiceFile: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    documentLink: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    invoiceMatchResult: {
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: "match-result-1",
        ...opts.data,
      })),
    },
    member: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ role: "admin" })),
    },
    contractor: {
      findFirst: vi.fn(async () => null),
    },
    contract: {
      findFirst: vi.fn(async () => null),
    },
    organization: {
      findUnique: vi.fn(async () => ({
        settingsJson: { invoiceDeviationThresholdPercent: 10 },
      })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Mock modules
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
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
}));

vi.mock("../../services/invoice-matching.js", () => ({
  computeDuplicateCheckHash: vi.fn(() => "hash-abc123"),
  runAutoMatch: vi.fn(async () => ({
    contractorId: "clcontractor000000000001",
    contractId: "clcontract0000000000000001",
    score: 95,
    matchStatus: "MATCHED",
    expectedAmountMinor: 100000,
    amountDeltaMinor: 0,
    amountDeltaPercent: 0,
    flags: [],
    duplicateInvoiceId: null,
  })),
}));

vi.mock("../../services/notification-service.js", () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock("../../services/calendar-event-service.js", () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/sanitize.js", () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock("../../services/stripe-client.js", () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock("../../services/billing-service.js", () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock("../../services/cache.js", () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dash:${orgId}` },
  CacheTTL: { DASHBOARD: 300 },
}));

vi.mock("../../services/r2.js", () => ({
  createPresignedUploadUrl: vi.fn(async () => ({
    url: "https://r2.example.com/upload",
    key: "mock-key",
  })),
  createPresignedDownloadUrl: vi.fn(async () => "https://r2.example.com/download"),
  generateStorageKey: vi.fn(() => "mock-storage-key"),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock("../../services/mime-validator.js", () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock("../../services/virus-scanner.js", () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock("../../services/bank-account-crypto.js", () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock("../../services/approval-engine.js", () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => "ON_TIME"),
}));

vi.mock("../../services/calendar-deadline-sync.js", () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock("../../services/report-export.js", () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: "bW9jaw==", filename: "audit-log.csv" })),
}));

vi.mock("../../services/payment-export.js", () => ({
  generateCsv: vi.fn(async () => Buffer.from("csv-data")),
  generateElixir: vi.fn(() => Buffer.from("elixir-data")),
  generateSepaXml: vi.fn(() => Buffer.from("sepa-data")),
  resolveTransferTitle: vi.fn(() => "FV/2025/001"),
}));

vi.mock("../../services/bank-statement.js", () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
}));

vi.mock("../../services/credit-service.js", () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock("../../services/ocr-extraction.js", () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock("../../services/billing-webhook.js", () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock("@sentry/nextjs", () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock("@contractor-ops/logger", () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock("@contractor-ops/logger/metrics", () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from "../../init.js";
import { appRouter } from "../../root.js";
import { deleteCalendarEvent } from "../../services/calendar-event-service.js";
import { computeDuplicateCheckHash, runAutoMatch } from "../../services/invoice-matching.js";
import { dispatch } from "../../services/notification-service.js";

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeCaller(userId: string, orgId: string) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date("2099-01-01"),
      token: "mock-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: "Test User",
      email: `${userId}@example.com`,
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

const caller = makeCaller(USER_ID, ORG_ID);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    organizationId: ORG_ID,
    invoiceNumber: "FV/2025/001",
    issueDate: new Date("2025-01-15"),
    dueDate: new Date("2025-02-15"),
    currency: "PLN",
    subtotalMinor: 100000,
    totalMinor: 123000,
    amountToPayMinor: 123000,
    sellerTaxId: "1234567890",
    sellerName: "Acme Sp. z o.o.",
    status: "RECEIVED",
    matchStatus: "UNMATCHED",
    source: "MANUAL_UPLOAD",
    duplicateCheckHash: "hash-abc123",
    deletedAt: null,
    contractorId: null,
    contractId: null,
    flagsJson: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no duplicate found
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
});

// ===========================================================================
// TESTS
// ===========================================================================

describe("invoice.create", () => {
  const validInput = {
    invoiceNumber: "FV/2025/001",
    issueDate: "2025-01-15",
    dueDate: "2025-02-15",
    currency: "PLN",
    subtotalMinor: 100000,
    vatRate: "23" as const,
    vatAmountMinor: 23000,
    totalMinor: 123000,
    amountToPayMinor: 123000,
    sellerTaxId: "1234567890",
    sellerName: "Acme Sp. z o.o.",
    documentIds: [DOC_ID_1, DOC_ID_2],
  };

  it("creates invoice with organizationId and computes duplicateCheckHash", async () => {
    // No duplicate found, then create returns the invoice
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());

    await caller.invoice.create(validInput);

    // Verify computeDuplicateCheckHash was called with correct args
    expect(computeDuplicateCheckHash).toHaveBeenCalledWith("FV/2025/001", "1234567890", 123000);

    // Verify create was called with organizationId and hash
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          duplicateCheckHash: "hash-abc123",
          status: "RECEIVED",
          matchStatus: "UNMATCHED",
          source: "MANUAL_UPLOAD",
        }),
      }),
    );
  });

  it("creates InvoiceFile links for documentIds", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());

    await caller.invoice.create(validInput);

    expect(mockPrisma.invoiceFile.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          documentId: DOC_ID_1,
          role: "SOURCE_ORIGINAL",
        },
        {
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          documentId: DOC_ID_2,
          role: "SOURCE_ORIGINAL",
        },
      ],
    });
  });

  it("creates DocumentLink records for documentIds", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());

    await caller.invoice.create(validInput);

    expect(mockPrisma.documentLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: ORG_ID,
          documentId: DOC_ID_1,
          entityType: "INVOICE",
          entityId: INVOICE_ID,
          linkRole: "PRIMARY",
        },
        {
          organizationId: ORG_ID,
          documentId: DOC_ID_2,
          entityType: "INVOICE",
          entityId: INVOICE_ID,
          linkRole: "PRIMARY",
        },
      ],
    });
  });

  it("dispatches notification to FINANCE_ADMIN members", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());
    mockPrisma.member.findMany.mockResolvedValue([
      { userId: "finance-user-1" },
      { userId: "finance-user-2" },
    ]);

    await caller.invoice.create(validInput);

    // Verify member query for FINANCE_ADMIN
    expect(mockPrisma.member.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        role: "FINANCE_ADMIN",
      },
      select: { userId: true },
    });

    // Verify dispatch called with correct recipients
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        type: "INVOICE_RECEIVED",
        recipientUserIds: ["finance-user-1", "finance-user-2"],
        entityType: "INVOICE",
        entityId: INVOICE_ID,
      }),
    );
  });
});

describe("invoice.getById", () => {
  it("returns invoice with match results, scoped to org", async () => {
    const invoice = makeInvoice({
      contractor: { id: CONTRACTOR_ID, legalName: "Acme", taxId: "123" },
      contract: null,
      files: [],
      matchResults: [{ id: "mr-1", matchScore: 95 }],
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

    const result = await caller.invoice.getById({ id: INVOICE_ID });

    expect(result.id).toBe(INVOICE_ID);

    // Verify WHERE includes both id and organizationId
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: INVOICE_ID,
          organizationId: ORG_ID,
          deletedAt: null,
        }),
      }),
    );
  });

  it("throws NOT_FOUND for wrong organization", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(caller.invoice.getById({ id: INVOICE_ID })).rejects.toThrow(TRPCError);

    await expect(caller.invoice.getById({ id: INVOICE_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("invoice.list", () => {
  it("WHERE includes organizationId and deletedAt:null", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    await caller.invoice.list({ page: 1, pageSize: 20, sortBy: "received_at", sortOrder: "desc" });

    const findManyCall = mockPrisma.invoice.findMany.mock.calls[0]![0];
    expect(findManyCall.where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
    });
  });

  it("applies status filter when provided", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    await caller.invoice.list({
      page: 1,
      pageSize: 20,
      sortBy: "received_at",
      sortOrder: "desc",
      filters: { status: ["RECEIVED", "UNDER_REVIEW"] },
    });

    const findManyCall = mockPrisma.invoice.findMany.mock.calls[0]![0];
    expect(findManyCall.where.status).toEqual({ in: ["RECEIVED", "UNDER_REVIEW"] });
  });

  it("applies pagination and sorting", async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    await caller.invoice.list({
      page: 3,
      pageSize: 10,
      sortBy: "due_date",
      sortOrder: "asc",
    });

    const findManyCall = mockPrisma.invoice.findMany.mock.calls[0]![0];
    expect(findManyCall.skip).toBe(20);
    expect(findManyCall.take).toBe(10);
    expect(findManyCall.orderBy).toEqual({ dueDate: "asc" });
  });
});

describe("invoice.update", () => {
  it("WHERE includes id and organizationId", async () => {
    const existing = makeInvoice();
    // First call: findFirst for existing check
    mockPrisma.invoice.findFirst.mockResolvedValue(existing);
    mockPrisma.invoice.update.mockResolvedValue({ ...existing, sellerName: "Updated" });

    await caller.invoice.update({
      id: INVOICE_ID,
      data: { sellerName: "Updated" },
    });

    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: INVOICE_ID,
          organizationId: ORG_ID,
          deletedAt: null,
        }),
      }),
    );
  });

  it("throws NOT_FOUND when invoice not found", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      caller.invoice.update({ id: "nonexistent", data: { sellerName: "X" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("invoice.submitForMatching", () => {
  it("calls runAutoMatch with correct invoice data", async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      matchStatus: "MATCHED",
      status: "UNDER_REVIEW",
    });

    await caller.invoice.submitForMatching({ id: INVOICE_ID });

    expect(runAutoMatch).toHaveBeenCalledWith(
      mockPrisma,
      ORG_ID,
      {
        id: INVOICE_ID,
        sellerTaxId: "1234567890",
        totalMinor: 123000,
        currency: "PLN",
        duplicateCheckHash: "hash-abc123",
        servicePeriodStart: invoice.servicePeriodStart,
        servicePeriodEnd: invoice.servicePeriodEnd,
      },
      10, // deviationThreshold default
    );
  });

  it("updates invoice with match result in transaction", async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      matchStatus: "MATCHED",
    });

    await caller.invoice.submitForMatching({ id: INVOICE_ID });

    // Verify invoiceMatchResult.create was called
    expect(mockPrisma.invoiceMatchResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          matchedContractorId: CONTRACTOR_ID,
          matchedContractId: CONTRACT_ID,
          matchScore: 95,
          matchedBy: "RULE_ENGINE",
          status: "MATCHED",
        }),
      }),
    );

    // Verify invoice.update was called with match data
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          contractorId: CONTRACTOR_ID,
          contractId: CONTRACT_ID,
          matchStatus: "MATCHED",
          status: "UNDER_REVIEW",
        }),
      }),
    );
  });
});

describe("invoice.manualMatch", () => {
  it("updates contractorId and contractId on invoice", async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.contractor.findFirst.mockResolvedValue({
      id: CONTRACTOR_ID,
      organizationId: ORG_ID,
    });
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: CONTRACT_ID,
      organizationId: ORG_ID,
    });
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      contractorId: CONTRACTOR_ID,
      contractId: CONTRACT_ID,
    });

    await caller.invoice.manualMatch({
      invoiceId: INVOICE_ID,
      contractorId: CONTRACTOR_ID,
      contractId: CONTRACT_ID,
    });

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          contractorId: CONTRACTOR_ID,
          contractId: CONTRACT_ID,
          matchStatus: "MANUALLY_CONFIRMED",
        }),
      }),
    );
  });

  it("sets matchStatus to MANUALLY_CONFIRMED in match result", async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.contractor.findFirst.mockResolvedValue({
      id: CONTRACTOR_ID,
      organizationId: ORG_ID,
    });
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      matchStatus: "MANUALLY_CONFIRMED",
    });

    await caller.invoice.manualMatch({
      invoiceId: INVOICE_ID,
      contractorId: CONTRACTOR_ID,
    });

    expect(mockPrisma.invoiceMatchResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          matchedContractorId: CONTRACTOR_ID,
          matchScore: 100,
          matchedBy: "MANUAL",
          status: "MANUALLY_CONFIRMED",
        }),
      }),
    );
  });
});

describe("invoice.voidInvoice", () => {
  it("sets status to VOID", async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.update.mockResolvedValue({ ...invoice, status: "VOID" });

    await caller.invoice.voidInvoice({ id: INVOICE_ID });

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: { status: "VOID" },
    });
  });

  it("cleans up calendar events", async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.update.mockResolvedValue({ ...invoice, status: "VOID" });

    await caller.invoice.voidInvoice({ id: INVOICE_ID });

    expect(deleteCalendarEvent).toHaveBeenCalledWith(mockPrisma, {
      organizationId: ORG_ID,
      entityType: "INVOICE",
      entityId: INVOICE_ID,
    });
  });
});

describe("invoice.statusCounts", () => {
  it("returns counts grouped by status for org", async () => {
    mockPrisma.invoice.groupBy
      .mockResolvedValueOnce([
        { status: "RECEIVED", _count: { id: 5 } },
        { status: "UNDER_REVIEW", _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        { matchStatus: "UNMATCHED", _count: { id: 4 } },
        { matchStatus: "MATCHED", _count: { id: 2 } },
      ]);

    const result = await caller.invoice.statusCounts();

    expect(result).toEqual({
      "status:RECEIVED": 5,
      "status:UNDER_REVIEW": 3,
      "matchStatus:UNMATCHED": 4,
      "matchStatus:MATCHED": 2,
    });

    // Verify both groupBy calls are scoped to org
    const calls = mockPrisma.invoice.groupBy.mock.calls;
    expect(calls[0]![0].where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
    });
    expect(calls[1]![0].where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
    });
  });
});
