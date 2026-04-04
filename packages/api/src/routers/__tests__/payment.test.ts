/**
 * Payment router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, service modules, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test configures mock return values, calls the procedure,
 *    then asserts the arguments passed to Prisma (WHERE clauses, data).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
const USER_ID = "clyyyyyyyyyyyyyyyyyyyyyyyy";
const INVOICE_ID_1 = "clinvoice00000000000000001";
const INVOICE_ID_2 = "clinvoice00000000000000002";
const CONTRACTOR_ID = "clcontractor000000000001";
const RUN_ID = "clrun000000000000000000001";
const ITEM_ID = "clitem00000000000000000001";

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
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    paymentRun: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: RUN_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
    },
    paymentRunItem: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: ITEM_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      delete: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    paymentExport: {
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: "export-1",
        ...opts.data,
      })),
    },
    organization: {
      findUnique: vi.fn(async () => ({
        name: "Test Org",
        metadata: {
          settingsJson: {
            paymentTransferTitleTemplate: "{invoice_number}",
            bankAccount: { iban: "PL00000000000000000000000000", bic: "BREXPLPW" },
          },
        },
      })),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: "admin" })),
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

vi.mock("../../services/r2.js", () => ({
  createPresignedUploadUrl: vi.fn(async () => ({ url: "https://r2.example.com/upload", key: "mock-key" })),
  createPresignedDownloadUrl: vi.fn(async () => "https://r2.example.com/download"),
  generateStorageKey: vi.fn(() => "mock-storage-key"),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock("../../services/notification-service.js", () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock("../../services/invoice-matching.js", () => ({
  computeDuplicateCheckHash: vi.fn(() => "hash"),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock("../../services/bank-account-crypto.js", () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock("../../services/sanitize.js", () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock("../../services/approval-engine.js", () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => "ON_TIME"),
}));

vi.mock("../../services/calendar-event-service.js", () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/calendar-deadline-sync.js", () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock("../../services/report-export.js", () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: "bW9jaw==", filename: "audit-log-2025-01-01.csv" })),
}));

vi.mock("../../services/billing-service.js", () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock("../../services/cache.js", () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { approvalChains: (orgId: string) => `approval-chains:${orgId}` },
  CacheTTL: { APPROVAL_CHAINS: 300 },
}));

vi.mock("../../services/mime-validator.js", () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock("../../services/virus-scanner.js", () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
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

vi.mock("../../services/payment-export.js", () => ({
  generateCsv: vi.fn(async () => Buffer.from("csv-data")),
  generateElixir: vi.fn(() => Buffer.from("elixir-data")),
  generateSepaXml: vi.fn(() => Buffer.from("sepa-data")),
  resolveTransferTitle: vi.fn(() => "FV/2025/001"),
}));

vi.mock("../../services/bank-statement.js", () => ({
  parseBankStatement: vi.fn(() => [
    { amount: 100000, iban: "PL1234", reference: "FV/2025/001" },
  ]),
  matchStatementToRun: vi.fn(() => [
    { itemId: "clitem00000000000000000001", transactionIndex: 0, confidence: 1 },
  ]),
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
import { parseBankStatement, matchStatementToRun } from "../../services/bank-statement.js";

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
    id: INVOICE_ID_1,
    organizationId: ORG_ID,
    contractorId: CONTRACTOR_ID,
    billingProfileId: "bp-1",
    invoiceNumber: "FV/2025/001",
    paymentStatus: "READY",
    amountToPayGrosze: 100000,
    currency: "PLN",
    deletedAt: null,
    dueDate: new Date("2025-06-01"),
    billingProfile: { id: "bp-1", preferredCurrency: "PLN" },
    contractor: { id: CONTRACTOR_ID, legalName: "Acme", taxId: "1234567890" },
    contract: { id: "contract-1", contractNumber: "C/2025/001" },
    ...overrides,
  };
}

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    organizationId: ORG_ID,
    runNumber: "PR-2025-001",
    status: "DRAFT",
    currency: "PLN",
    totalGrosze: 100000,
    invoiceCount: 1,
    items: [],
    ...overrides,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    organizationId: ORG_ID,
    paymentRunId: RUN_ID,
    invoiceId: INVOICE_ID_1,
    contractorId: CONTRACTOR_ID,
    billingProfileId: "bp-1",
    amountGrosze: 100000,
    currency: "PLN",
    status: "PENDING",
    paymentRun: makeRun(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
  );
});

// ===========================================================================
// readyForPayment
// ===========================================================================

describe("payment router", () => {
  describe("readyForPayment", () => {
    it("queries with paymentStatus READY and organizationId", async () => {
      mockPrisma.invoice.findMany.mockResolvedValueOnce([]);

      await caller.payment.readyForPayment({ limit: 10 });

      const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        paymentStatus: "READY",
        deletedAt: null,
      });
    });

    it("applies currency filter when provided", async () => {
      mockPrisma.invoice.findMany.mockResolvedValueOnce([]);

      await caller.payment.readyForPayment({ limit: 10, currency: "EUR" });

      const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        currency: "EUR",
        paymentStatus: "READY",
      });
    });

    it("applies contractorId filter when provided", async () => {
      mockPrisma.invoice.findMany.mockResolvedValueOnce([]);

      await caller.payment.readyForPayment({
        limit: 10,
        contractorId: CONTRACTOR_ID,
      });

      const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        contractorId: CONTRACTOR_ID,
        paymentStatus: "READY",
      });
    });
  });

  // =========================================================================
  // create
  // =========================================================================

  describe("create", () => {
    it("creates a DRAFT run and sets invoice paymentStatus to IN_RUN", async () => {
      const invoice1 = makeInvoice();
      const invoice2 = makeInvoice({
        id: INVOICE_ID_2,
        invoiceNumber: "FV/2025/002",
        amountToPayGrosze: 200000,
      });

      mockPrisma.invoice.findMany.mockResolvedValueOnce([invoice1, invoice2]);
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(null); // no existing runs

      await caller.payment.create({
        invoiceIds: [INVOICE_ID_1, INVOICE_ID_2],
      });

      // Verify run created with DRAFT status
      const createCall = mockPrisma.paymentRun.create.mock.calls[0]?.[0];
      expect(createCall.data).toMatchObject({
        organizationId: ORG_ID,
        status: "DRAFT",
        totalGrosze: 300000,
        invoiceCount: 2,
      });

      // Verify invoices updated to IN_RUN
      const invoiceUpdates = mockPrisma.invoice.update.mock.calls;
      expect(invoiceUpdates).toHaveLength(2);
      expect(invoiceUpdates[0][0].data).toMatchObject({ paymentStatus: "IN_RUN" });
      expect(invoiceUpdates[1][0].data).toMatchObject({ paymentStatus: "IN_RUN" });
    });

    it("generates run number with year prefix PR-{year}-{seq}", async () => {
      const invoice = makeInvoice();
      mockPrisma.invoice.findMany.mockResolvedValueOnce([invoice]);
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce({
        runNumber: `PR-${new Date().getFullYear()}-005`,
      });

      await caller.payment.create({ invoiceIds: [INVOICE_ID_1] });

      const createCall = mockPrisma.paymentRun.create.mock.calls[0]?.[0];
      const year = new Date().getFullYear();
      expect(createCall.data.runNumber).toBe(`PR-${year}-006`);
    });

    it("rejects invoices not in READY status", async () => {
      const invoice = makeInvoice({ paymentStatus: "IN_RUN" });
      mockPrisma.invoice.findMany.mockResolvedValueOnce([invoice]);

      await expect(
        caller.payment.create({ invoiceIds: [INVOICE_ID_1] }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "PAYMENT_INVOICES_NOT_READY",
      });
    });

    it("groups by currency when groupByCurrency is true", async () => {
      const invoicePLN = makeInvoice({ currency: "PLN", amountToPayGrosze: 100000 });
      const invoiceEUR = makeInvoice({
        id: INVOICE_ID_2,
        currency: "EUR",
        amountToPayGrosze: 50000,
        billingProfile: { id: "bp-2", preferredCurrency: "EUR" },
      });

      mockPrisma.invoice.findMany.mockResolvedValueOnce([invoicePLN, invoiceEUR]);
      // First findFirst for PLN run number, second for EUR run number
      mockPrisma.paymentRun.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await caller.payment.create({
        invoiceIds: [INVOICE_ID_1, INVOICE_ID_2],
        groupByCurrency: true,
      });

      // Two runs created (one PLN, one EUR)
      expect(mockPrisma.paymentRun.create).toHaveBeenCalledTimes(2);

      const firstRunData = mockPrisma.paymentRun.create.mock.calls[0][0].data;
      const secondRunData = mockPrisma.paymentRun.create.mock.calls[1][0].data;

      const currencies = [firstRunData.currency, secondRunData.currency].sort();
      expect(currencies).toEqual(["EUR", "PLN"]);
    });
  });

  // =========================================================================
  // removeFromRun
  // =========================================================================

  describe("removeFromRun", () => {
    it("resets invoice paymentStatus to READY and recalculates totals", async () => {
      const run = makeRun({ invoiceCount: 2, totalGrosze: 300000 });
      const item = makeItem();
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);
      mockPrisma.paymentRunItem.findFirst.mockResolvedValueOnce(item);
      mockPrisma.paymentRunItem.findMany.mockResolvedValueOnce([
        { amountGrosze: 200000 },
      ]);

      await caller.payment.removeFromRun({
        runId: RUN_ID,
        invoiceId: INVOICE_ID_1,
      });

      // Invoice reset to READY
      const invoiceUpdate = mockPrisma.invoice.update.mock.calls[0][0];
      expect(invoiceUpdate.where).toEqual({ id: INVOICE_ID_1 });
      expect(invoiceUpdate.data).toMatchObject({ paymentStatus: "READY" });

      // Item deleted
      expect(mockPrisma.paymentRunItem.delete).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
      });

      // Run totals recalculated
      const runUpdate = mockPrisma.paymentRun.update.mock.calls[0][0];
      expect(runUpdate.data).toMatchObject({
        totalGrosze: 200000,
        invoiceCount: 1,
      });
    });

    it("rejects removal from non-DRAFT runs", async () => {
      const run = makeRun({ status: "EXPORTED" });
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await expect(
        caller.payment.removeFromRun({
          runId: RUN_ID,
          invoiceId: INVOICE_ID_1,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "PAYMENT_RUN_NOT_DRAFT",
      });
    });

    it("auto-cancels run when last item is removed", async () => {
      const run = makeRun();
      const item = makeItem();
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);
      mockPrisma.paymentRunItem.findFirst.mockResolvedValueOnce(item);
      mockPrisma.paymentRunItem.findMany.mockResolvedValueOnce([]); // no remaining items

      await caller.payment.removeFromRun({
        runId: RUN_ID,
        invoiceId: INVOICE_ID_1,
      });

      const runUpdate = mockPrisma.paymentRun.update.mock.calls[0][0];
      expect(runUpdate.data).toMatchObject({
        totalGrosze: 0,
        invoiceCount: 0,
        status: "CANCELLED",
      });
    });
  });

  // =========================================================================
  // lockAndExport
  // =========================================================================

  describe("lockAndExport", () => {
    it("transitions DRAFT to EXPORTED and returns file base64", async () => {
      const run = makeRun({
        status: "DRAFT",
        items: [
          {
            id: ITEM_ID,
            amountGrosze: 100000,
            currency: "PLN",
            invoice: {
              invoiceNumber: "FV/2025/001",
              dueDate: new Date("2025-06-01"),
              servicePeriodStart: null,
              servicePeriodEnd: null,
            },
            contractor: { legalName: "Acme", taxId: "1234567890" },
            billingProfile: {
              bankAccountMasked: "PL12345678901234567890123456",
              swiftBic: "BREXPLPW",
              bankName: "Test Bank",
            },
          },
        ],
      });

      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      const result = await caller.payment.lockAndExport({
        runId: RUN_ID,
        exportFormat: "CSV",
      });

      // Run updated to EXPORTED
      const updateCall = mockPrisma.paymentRun.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({
        status: "EXPORTED",
        exportFormat: "CSV",
      });
      expect(updateCall.data.exportedAt).toBeInstanceOf(Date);

      // Export record created
      expect(mockPrisma.paymentExport.create).toHaveBeenCalledTimes(1);
      const exportData = mockPrisma.paymentExport.create.mock.calls[0][0].data;
      expect(exportData).toMatchObject({
        format: "CSV",
        status: "GENERATED",
        organizationId: ORG_ID,
      });

      // Returns base64 content
      expect(result.fileBase64).toBe(Buffer.from("csv-data").toString("base64"));
      expect(result.fileName).toContain(".csv");
    });

    it("rejects transition from COMPLETED status", async () => {
      const run = makeRun({ status: "COMPLETED" });
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await expect(
        caller.payment.lockAndExport({
          runId: RUN_ID,
          exportFormat: "CSV",
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "PAYMENT_RUN_INVALID_STATUS",
      });
    });
  });

  // =========================================================================
  // updateItemStatus
  // =========================================================================

  describe("updateItemStatus", () => {
    it("marks item as PAID and updates invoice paymentStatus to PAID", async () => {
      const item = makeItem();
      mockPrisma.paymentRunItem.findFirst.mockResolvedValueOnce(item);
      mockPrisma.paymentRunItem.count
        .mockResolvedValueOnce(1)  // remaining non-terminal
        .mockResolvedValueOnce(0); // failed count (not reached since remaining > 0)

      await caller.payment.updateItemStatus({
        itemId: ITEM_ID,
        status: "PAID",
        paymentReference: "REF-001",
      });

      // Item updated to PAID
      const itemUpdate = mockPrisma.paymentRunItem.update.mock.calls[0][0];
      expect(itemUpdate.data).toMatchObject({
        status: "PAID",
        paymentReference: "REF-001",
        failureReason: null,
      });
      expect(itemUpdate.data.markedPaidAt).toBeInstanceOf(Date);

      // Invoice updated to PAID
      const invoiceUpdate = mockPrisma.invoice.update.mock.calls[0][0];
      expect(invoiceUpdate.where).toEqual({ id: INVOICE_ID_1 });
      expect(invoiceUpdate.data).toMatchObject({ paymentStatus: "PAID" });
      expect(invoiceUpdate.data.paidAt).toBeInstanceOf(Date);
    });

    it("marks item as FAILED and releases invoice to READY", async () => {
      const item = makeItem();
      mockPrisma.paymentRunItem.findFirst.mockResolvedValueOnce(item);
      mockPrisma.paymentRunItem.count
        .mockResolvedValueOnce(1)  // remaining non-terminal
        .mockResolvedValueOnce(0);

      await caller.payment.updateItemStatus({
        itemId: ITEM_ID,
        status: "FAILED",
        failureReason: "Bank rejected transfer",
      });

      // Item updated to FAILED
      const itemUpdate = mockPrisma.paymentRunItem.update.mock.calls[0][0];
      expect(itemUpdate.data).toMatchObject({
        status: "FAILED",
        failureReason: "Bank rejected transfer",
      });
      expect(itemUpdate.data.markedPaidAt).toBeNull();

      // Invoice released back to READY
      const invoiceUpdate = mockPrisma.invoice.update.mock.calls[0][0];
      expect(invoiceUpdate.data).toMatchObject({ paymentStatus: "READY" });
    });

    it("requires failureReason when status is FAILED", async () => {
      await expect(
        caller.payment.updateItemStatus({
          itemId: ITEM_ID,
          status: "FAILED",
          // no failureReason
        }),
      ).rejects.toThrow(); // Zod validation rejects at input level
    });
  });

  // =========================================================================
  // markAllPaid
  // =========================================================================

  describe("markAllPaid", () => {
    it("updates all pending items to PAID and invoices to PAID", async () => {
      const run = makeRun({
        status: "EXPORTED",
        items: [
          makeItem({ id: "item-1", invoiceId: INVOICE_ID_1, status: "PENDING" }),
          makeItem({ id: "item-2", invoiceId: INVOICE_ID_2, status: "PENDING" }),
        ],
      });

      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await caller.payment.markAllPaid({
        runId: RUN_ID,
        batchReference: "BATCH-001",
      });

      // Items batch-updated to PAID via updateMany
      expect(mockPrisma.paymentRunItem.updateMany).toHaveBeenCalledTimes(1);
      const itemUpdate = mockPrisma.paymentRunItem.updateMany.mock.calls[0][0];
      expect(itemUpdate.where.id.in).toEqual(["item-1", "item-2"]);
      expect(itemUpdate.data).toMatchObject({
        status: "PAID",
        paymentReference: "BATCH-001",
      });
      expect(itemUpdate.data.markedPaidAt).toBeInstanceOf(Date);

      // Invoices batch-updated to PAID via updateMany
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledTimes(1);
      const invUpdate = mockPrisma.invoice.updateMany.mock.calls[0][0];
      expect(invUpdate.where.id.in).toEqual([INVOICE_ID_1, INVOICE_ID_2]);
      expect(invUpdate.data).toMatchObject({ paymentStatus: "PAID" });
      expect(invUpdate.data.paidAt).toBeInstanceOf(Date);
    });

    it("sets run status to COMPLETED", async () => {
      const run = makeRun({
        status: "EXPORTED",
        items: [makeItem({ status: "PENDING" })],
      });

      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await caller.payment.markAllPaid({ runId: RUN_ID });

      // Run marked COMPLETED
      const runUpdate = mockPrisma.paymentRun.update.mock.calls[0][0];
      expect(runUpdate.data).toMatchObject({ status: "COMPLETED" });
      expect(runUpdate.data.completedAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // cancel
  // =========================================================================

  describe("cancel", () => {
    it("cancels DRAFT run and releases invoices to READY", async () => {
      const run = makeRun({
        status: "DRAFT",
        items: [
          makeItem({ id: "item-1", invoiceId: INVOICE_ID_1, status: "PENDING" }),
          makeItem({ id: "item-2", invoiceId: INVOICE_ID_2, status: "PENDING" }),
        ],
      });

      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await caller.payment.cancel({ runId: RUN_ID });

      // All invoices batch-released to READY via updateMany
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledTimes(1);
      const invUpdate = mockPrisma.invoice.updateMany.mock.calls[0][0];
      expect(invUpdate.where.id.in).toEqual([INVOICE_ID_1, INVOICE_ID_2]);
      expect(invUpdate.data).toMatchObject({ paymentStatus: "READY" });

      // Run set to CANCELLED
      const runUpdate = mockPrisma.paymentRun.update.mock.calls[0][0];
      expect(runUpdate.data).toMatchObject({ status: "CANCELLED" });
    });

    it("requires admin role to cancel EXPORTED run", async () => {
      const run = makeRun({ status: "EXPORTED", items: [] });
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);
      mockPrisma.member.findFirst.mockResolvedValueOnce({ role: "member" });

      await expect(
        caller.payment.cancel({ runId: RUN_ID }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("rejects cancellation of COMPLETED run", async () => {
      const run = makeRun({ status: "COMPLETED", items: [] });
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await expect(
        caller.payment.cancel({ runId: RUN_ID }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "PAYMENT_RUN_INVALID_STATUS",
      });
    });
  });

  // =========================================================================
  // listByContractor
  // =========================================================================

  describe("listByContractor", () => {
    it("queries with contractorId and organizationId", async () => {
      mockPrisma.paymentRunItem.findMany.mockResolvedValueOnce([]);

      await caller.payment.listByContractor({ contractorId: CONTRACTOR_ID });

      const call = mockPrisma.paymentRunItem.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
      });
    });
  });

  // =========================================================================
  // importStatement
  // =========================================================================

  describe("importStatement", () => {
    it("calls parseBankStatement with file content and name", async () => {
      const run = makeRun({
        status: "EXPORTED",
        items: [
          makeItem({
            billingProfile: { bankAccountMasked: "PL12345" },
          }),
        ],
      });
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await caller.payment.importStatement({
        runId: RUN_ID,
        fileContent: "MT940-content-here",
        fileName: "statement.mt940",
      });

      expect(parseBankStatement).toHaveBeenCalledWith(
        "MT940-content-here",
        "statement.mt940",
      );
      expect(matchStatementToRun).toHaveBeenCalledTimes(1);
    });

    it("rejects import for non-EXPORTED runs", async () => {
      const run = makeRun({ status: "DRAFT" });
      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);

      await expect(
        caller.payment.importStatement({
          runId: RUN_ID,
          fileContent: "data",
          fileName: "stmt.csv",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  // =========================================================================
  // confirmStatementMatches
  // =========================================================================

  describe("confirmStatementMatches", () => {
    it("marks matched items as PAID and updates invoices", async () => {
      const run = makeRun({ status: "EXPORTED" });
      const item = makeItem();

      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);
      mockPrisma.paymentRunItem.findFirst.mockResolvedValueOnce(item);
      // After marking paid: 0 remaining -> auto-complete
      mockPrisma.paymentRunItem.count
        .mockResolvedValueOnce(0)  // remaining pending/exported
        .mockResolvedValueOnce(0); // failed count
      mockPrisma.paymentRun.findUnique.mockResolvedValueOnce({
        ...run,
        status: "COMPLETED",
        items: [{ ...item, status: "PAID" }],
      });

      await caller.payment.confirmStatementMatches({
        runId: RUN_ID,
        matches: [{ itemId: ITEM_ID, transactionIndex: 0 }],
      });

      // Item updated to PAID
      const itemUpdate = mockPrisma.paymentRunItem.update.mock.calls[0][0];
      expect(itemUpdate.data).toMatchObject({ status: "PAID" });
      expect(itemUpdate.data.markedPaidAt).toBeInstanceOf(Date);

      // Invoice updated to PAID
      const invoiceUpdate = mockPrisma.invoice.update.mock.calls[0][0];
      expect(invoiceUpdate.data).toMatchObject({ paymentStatus: "PAID" });
    });

    it("auto-completes run when all items are terminal", async () => {
      const run = makeRun({ status: "EXPORTED" });
      const item = makeItem();

      mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);
      mockPrisma.paymentRunItem.findFirst.mockResolvedValueOnce(item);
      // 0 remaining -> triggers auto-complete
      mockPrisma.paymentRunItem.count
        .mockResolvedValueOnce(0)  // remaining
        .mockResolvedValueOnce(0); // failed
      mockPrisma.paymentRun.findUnique.mockResolvedValueOnce({
        ...run,
        status: "COMPLETED",
        items: [{ ...item, status: "PAID" }],
      });

      await caller.payment.confirmStatementMatches({
        runId: RUN_ID,
        matches: [{ itemId: ITEM_ID, transactionIndex: 0 }],
      });

      // Run auto-completed (second update call is the auto-complete)
      const runUpdateCalls = mockPrisma.paymentRun.update.mock.calls;
      const completionCall = runUpdateCalls.find(
        (c: Array<{ data: Record<string, unknown> }>) => c[0].data.status === "COMPLETED",
      );
      expect(completionCall).toBeDefined();
      expect(completionCall![0].data).toMatchObject({ status: "COMPLETED" });
      expect(completionCall![0].data.completedAt).toBeInstanceOf(Date);
    });
  });
});
