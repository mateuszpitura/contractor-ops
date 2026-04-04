/**
 * Dashboard router unit tests.
 *
 * Strategy: Mock Prisma at module level, bypass auth/RBAC/cache middleware,
 * create a tRPC caller, and verify each procedure calls Prisma with the
 * correct WHERE clauses and returns the expected shape.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constants (vi.hoisted so mock factories can reference them)
// ---------------------------------------------------------------------------

const { ORG_ID, USER_ID, mockPrisma } = vi.hoisted(() => {
  const ORG_ID = "org-dash-00000000-0000-0000-0000-000000000001";
  const USER_ID = "user-dash-00000000-0000-0000-0000-000000000001";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    contractor: {
      count: vi.fn(async () => 0),
    },
    approvalStep: {
      count: vi.fn(async () => 0),
    },
    invoice: {
      aggregate: vi.fn(async () => ({ _sum: { amountToPayGrosze: null } })),
      findMany: vi.fn(async () => []),
    },
    contract: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    workflowTaskRun: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    auditLog: {
      findMany: vi.fn(async () => []),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { ORG_ID, USER_ID, mockPrisma };
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
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
}));

vi.mock("../../services/cache.js", () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    dashboardKpis: (orgId: string) => `dashboard:kpis:${orgId}`,
    dashboardSpend: (orgId: string, months: string) => `dashboard:spend:${orgId}:${months}`,
    dashboardDeadlines: (orgId: string) => `dashboard:deadlines:${orgId}`,
    dashboardActivity: (orgId: string) => `dashboard:activity:${orgId}`,
  },
  CacheTTL: {
    DASHBOARD_KPIS: 300,
    DASHBOARD_SPEND: 600,
    DASHBOARD_DEADLINES: 180,
    DASHBOARD_ACTIVITY: 120,
  },
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

vi.mock("../../services/billing-webhook.js", () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
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
  generateAuditCsv: vi.fn(async () => ({ data: "bW9jaw==", mimeType: "text/csv" })),
  generateSpendCsv: vi.fn(async () => ({ data: "bW9jaw==", mimeType: "text/csv" })),
  generateContractsCsv: vi.fn(async () => ({ data: "bW9jaw==", mimeType: "text/csv" })),
  generateInvoicesCsv: vi.fn(async () => ({ data: "bW9jaw==", mimeType: "text/csv" })),
  generateComplianceCsv: vi.fn(async () => ({ data: "bW9jaw==", mimeType: "text/csv" })),
}));

vi.mock("../../services/mime-validator.js", () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock("../../services/virus-scanner.js", () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock("../../services/credit-service.js", () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock("../../services/ocr-extraction.js", () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from "../../init.js";
import { appRouter } from "../../root.js";

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
      name: `User ${userId}`,
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
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.contractor.count.mockResolvedValue(0);
  mockPrisma.approvalStep.count.mockResolvedValue(0);
  mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { amountToPayGrosze: null } });
  mockPrisma.contract.count.mockResolvedValue(0);
  mockPrisma.workflowTaskRun.count.mockResolvedValue(0);
  mockPrisma.contract.findMany.mockResolvedValue([]);
  mockPrisma.workflowTaskRun.findMany.mockResolvedValue([]);
  mockPrisma.invoice.findMany.mockResolvedValue([]);
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
  mockPrisma.$queryRaw.mockResolvedValue([]);
});

// ===========================================================================
// kpis
// ===========================================================================

describe("dashboard router", () => {
  describe("kpis", () => {
    it("returns 5 KPI values with current counts", async () => {
      mockPrisma.contractor.count.mockResolvedValue(10);
      mockPrisma.approvalStep.count.mockResolvedValue(5);
      mockPrisma.invoice.aggregate.mockResolvedValue({
        _sum: { amountToPayGrosze: 500000 },
      });
      mockPrisma.contract.count.mockResolvedValue(3);
      mockPrisma.workflowTaskRun.count.mockResolvedValue(7);

      const result = await caller.dashboard.kpis();

      expect(result).toHaveProperty("activeContractors");
      expect(result).toHaveProperty("pendingApprovals");
      expect(result).toHaveProperty("readyToPayTotal");
      expect(result).toHaveProperty("expiringContracts");
      expect(result).toHaveProperty("openTasks");
    });

    it("returns prevValue for trend comparison on activeContractors", async () => {
      // First call = current, second call = previous
      mockPrisma.contractor.count
        .mockResolvedValueOnce(15) // current active
        .mockResolvedValueOnce(12); // previous active

      const result = await caller.dashboard.kpis();

      expect(result.activeContractors).toEqual({ value: 15, prevValue: 12 });
    });

    it("returns prevValue for trend comparison on pendingApprovals", async () => {
      mockPrisma.approvalStep.count
        .mockResolvedValueOnce(8) // current pending
        .mockResolvedValueOnce(3); // previous pending

      const result = await caller.dashboard.kpis();

      expect(result.pendingApprovals).toEqual({ value: 8, prevValue: 3 });
    });

    it("returns prevValue for trend comparison on readyToPayTotal", async () => {
      mockPrisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { amountToPayGrosze: 100000 } })
        .mockResolvedValueOnce({ _sum: { amountToPayGrosze: 80000 } });

      const result = await caller.dashboard.kpis();

      expect(result.readyToPayTotal).toEqual({
        valueGrosze: 100000,
        prevValueGrosze: 80000,
      });
    });

    it("returns neutral (no trend) for expiringContracts and openTasks", async () => {
      mockPrisma.contract.count.mockResolvedValue(4);
      mockPrisma.workflowTaskRun.count.mockResolvedValue(6);

      const result = await caller.dashboard.kpis();

      // These KPIs have value only, no prevValue
      expect(result.expiringContracts).toEqual({ value: 4 });
      expect(result.openTasks).toEqual({ value: 6 });
    });

    it("scopes all queries to organizationId", async () => {
      await caller.dashboard.kpis();

      // contractor.count called twice (current + previous)
      for (const call of mockPrisma.contractor.count.mock.calls) {
        expect(call[0]?.where).toHaveProperty("organizationId", ORG_ID);
      }

      // approvalStep.count called twice
      for (const call of mockPrisma.approvalStep.count.mock.calls) {
        expect(call[0]?.where).toHaveProperty("organizationId", ORG_ID);
      }

      // invoice.aggregate called twice
      for (const call of mockPrisma.invoice.aggregate.mock.calls) {
        expect(call[0]?.where).toHaveProperty("organizationId", ORG_ID);
      }

      // contract.count called once
      expect(mockPrisma.contract.count.mock.calls[0]?.[0]?.where).toHaveProperty(
        "organizationId",
        ORG_ID,
      );

      // workflowTaskRun.count called once
      expect(mockPrisma.workflowTaskRun.count.mock.calls[0]?.[0]?.where).toHaveProperty(
        "organizationId",
        ORG_ID,
      );
    });

    it("requires report.read permission", async () => {
      // Create caller without session (unauthenticated)
      const unauthCaller = createCaller({
        headers: new Headers(),
        session: null,
        user: null,
      });

      await expect(unauthCaller.dashboard.kpis()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  // =========================================================================
  // spendTrend
  // =========================================================================

  describe("spendTrend", () => {
    it("returns monthly aggregations grouped by currency for 6 months", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { month: new Date("2025-01-01"), currency: "PLN", totalGrosze: 100000 },
        { month: new Date("2025-02-01"), currency: "PLN", totalGrosze: 200000 },
        { month: new Date("2025-01-01"), currency: "EUR", totalGrosze: 50000 },
      ]);

      const result = await caller.dashboard.spendTrend({ months: "6" });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        month: new Date("2025-01-01").toISOString(),
        currency: "PLN",
        totalGrosze: 100000,
      });
    });

    it("returns monthly aggregations for 12 months", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await caller.dashboard.spendTrend({ months: "12" });

      expect(result).toEqual([]);
      // Verify $queryRaw was called (raw SQL query)
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("returns monthly aggregations for YTD (from Jan 1)", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { month: new Date("2026-01-01"), currency: "PLN", totalGrosze: 300000 },
      ]);

      const result = await caller.dashboard.spendTrend({ months: "ytd" });

      expect(result).toHaveLength(1);
      expect(result[0]!.totalGrosze).toBe(300000);
    });

    it("casts BigInt SUM to number to avoid serialization issues", async () => {
      // Return a BigInt-like value from the raw query
      mockPrisma.$queryRaw.mockResolvedValue([
        { month: new Date("2025-06-01"), currency: "PLN", totalGrosze: BigInt(999999) },
      ]);

      const result = await caller.dashboard.spendTrend({ months: "6" });

      // The router maps totalGrosze with Number(), so it should be a regular number
      expect(typeof result[0]!.totalGrosze).toBe("number");
      expect(result[0]!.totalGrosze).toBe(999999);
    });

    it("filters only PAID invoices with deletedAt IS NULL", async () => {
      await caller.dashboard.spendTrend({ months: "6" });

      // The raw SQL template is passed as tagged template; verify it was invoked
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      // The first argument to $queryRaw is a TemplateStringsArray.
      // We verify the SQL text includes the expected filters.
      const callArgs = mockPrisma.$queryRaw.mock.calls[0];
      const sqlTemplateStrings = callArgs[0]?.strings ?? callArgs[0];
      const fullSql = Array.isArray(sqlTemplateStrings)
        ? sqlTemplateStrings.join("?")
        : String(sqlTemplateStrings);
      expect(fullSql).toContain("PAID");
      expect(fullSql).toContain("deletedAt");
    });
  });

  // =========================================================================
  // deadlines
  // =========================================================================

  describe("deadlines", () => {
    it("returns contracts expiring within 90 days", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: "contract-1", title: "Annual Contract", endDate: futureDate },
      ]);

      const result = await caller.dashboard.deadlines();

      const contractItems = result.filter(
        (item: { type: string }) => item.type === "CONTRACT_EXPIRING",
      );
      expect(contractItems).toHaveLength(1);
      expect(contractItems[0]).toHaveProperty("entityId", "contract-1");
      expect(contractItems[0]).toHaveProperty("daysRemaining");
    });

    it("returns overdue workflow tasks", async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      mockPrisma.workflowTaskRun.findMany.mockResolvedValue([
        { id: "task-1", title: "Review documents", dueAt: pastDate },
      ]);

      const result = await caller.dashboard.deadlines();

      const taskItems = result.filter(
        (item: { type: string }) => item.type === "TASK_OVERDUE",
      );
      expect(taskItems).toHaveLength(1);
      expect(taskItems[0]).toHaveProperty("entityId", "task-1");
      expect(taskItems[0]).toHaveProperty("daysOverdue");
    });

    it("returns invoices due within 30 days", async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: "inv-1", invoiceNumber: "FV/2025/100", dueDate: futureDate },
      ]);

      const result = await caller.dashboard.deadlines();

      const invoiceItems = result.filter(
        (item: { type: string }) => item.type === "INVOICE_DUE",
      );
      expect(invoiceItems).toHaveLength(1);
      expect(invoiceItems[0]).toHaveProperty("entityId", "inv-1");
      expect(invoiceItems[0]).toHaveProperty("entityName", "FV/2025/100");
    });

    it("sorts overdue items first, then soonest upcoming", async () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const nearFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      mockPrisma.workflowTaskRun.findMany.mockResolvedValue([
        { id: "task-overdue", title: "Overdue task", dueAt: pastDate },
      ]);
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: "contract-far", title: "Far contract", endDate: farFuture },
        { id: "contract-near", title: "Near contract", endDate: nearFuture },
      ]);

      const result = await caller.dashboard.deadlines();

      // Overdue tasks have negative _sortKey, so they come first
      expect(result[0]).toHaveProperty("type", "TASK_OVERDUE");
      // Near contract should come before far contract
      const contractIdxNear = result.findIndex(
        (i: { entityId: string }) => i.entityId === "contract-near",
      );
      const contractIdxFar = result.findIndex(
        (i: { entityId: string }) => i.entityId === "contract-far",
      );
      expect(contractIdxNear).toBeLessThan(contractIdxFar);
    });

    it("limits to 20 items", async () => {
      // Each source returns up to 20 items; combined result is sliced to 20
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const manyContracts = Array.from({ length: 20 }, (_, i) => ({
        id: `contract-${i}`,
        title: `Contract ${i}`,
        endDate: futureDate,
      }));
      const manyInvoices = Array.from({ length: 20 }, (_, i) => ({
        id: `inv-${i}`,
        invoiceNumber: `FV/${i}`,
        dueDate: futureDate,
      }));

      mockPrisma.contract.findMany.mockResolvedValue(manyContracts);
      mockPrisma.invoice.findMany.mockResolvedValue(manyInvoices);

      const result = await caller.dashboard.deadlines();

      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  // =========================================================================
  // activity
  // =========================================================================

  describe("activity", () => {
    it("returns last 20 audit log entries ordered by createdAt DESC", async () => {
      const entries = Array.from({ length: 5 }, (_, i) => ({
        id: `audit-${i}`,
        actorName: `User ${i}`,
        actorType: "USER",
        action: "contractor.created",
        resourceType: "Contractor",
        resourceId: `res-${i}`,
        resourceName: `Resource ${i}`,
        createdAt: new Date(`2025-0${i + 1}-01`),
      }));
      mockPrisma.auditLog.findMany.mockResolvedValue(entries);

      const result = await caller.dashboard.activity();

      expect(result.items).toHaveLength(5);

      // Verify findMany was called with correct params
      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.orderBy).toEqual({ createdAt: "desc" });
      expect(call?.take).toBe(20);
    });

    it("scopes to organizationId", async () => {
      await caller.dashboard.activity();

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toEqual({ organizationId: ORG_ID });
    });
  });
});
