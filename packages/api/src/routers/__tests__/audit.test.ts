/**
 * Audit router unit tests.
 *
 * Strategy: Mock Prisma at module level, bypass auth/RBAC middleware,
 * create a tRPC caller, and verify each procedure calls Prisma with the
 * correct WHERE clauses including organizationId scoping, filters, and pagination.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constants (vi.hoisted so mock factories can reference them)
// ---------------------------------------------------------------------------

const { ORG_ID, USER_ID, mockPrisma, mockGenerateAuditCsv } = vi.hoisted(() => {
  const ORG_ID = "org-audit-00000000-0000-0000-0000-000000000001";
  const USER_ID = "user-audit-00000000-0000-0000-0000-000000000001";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    auditLog: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  const mockGenerateAuditCsv = vi.fn(async () => ({
    data: "bW9ja0NTVg==",
    mimeType: "text/csv;charset=utf-8",
  }));

  return { ORG_ID, USER_ID, mockPrisma, mockGenerateAuditCsv };
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

vi.mock("../../services/report-export.js", () => ({
  generateAuditCsv: mockGenerateAuditCsv,
}));

vi.mock("../../services/cache.js", () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
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
  getSubscription: vi.fn(async () => ({
    id: "sub_audit_mock",
    status: "ACTIVE",
    tier: "ENTERPRISE",
  })),
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
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
  mockPrisma.auditLog.count.mockResolvedValue(0);
  mockGenerateAuditCsv.mockResolvedValue({
    data: "bW9ja0NTVg==",
    mimeType: "text/csv;charset=utf-8",
  });
});

// ===========================================================================
// list
// ===========================================================================

describe("audit router", () => {
  describe("list", () => {
    it("returns paginated audit log entries scoped to organizationId", async () => {
      const entries = [
        {
          id: "audit-1",
          organizationId: ORG_ID,
          actorName: "Admin",
          action: "contractor.created",
          resourceType: "Contractor",
          createdAt: new Date(),
        },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(entries);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await caller.audit.list({
        page: 1,
        pageSize: 25,
        sortOrder: "desc",
      });

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);

      // Verify organizationId scoping
      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty("organizationId", ORG_ID);
    });

    it("supports full-text search across actorName, resourceName, action", async () => {
      await caller.audit.list({
        page: 1,
        pageSize: 25,
        sortOrder: "desc",
        search: "invoice",
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty("OR");
      expect(call.where.OR).toEqual([
        { actorName: { contains: "invoice", mode: "insensitive" } },
        { resourceName: { contains: "invoice", mode: "insensitive" } },
        { action: { contains: "invoice", mode: "insensitive" } },
      ]);
    });

    it("filters by actorId when provided", async () => {
      await caller.audit.list({
        page: 1,
        pageSize: 25,
        sortOrder: "desc",
        actorId: "user-123",
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty("actorId", "user-123");
    });

    it("filters by action when provided", async () => {
      await caller.audit.list({
        page: 1,
        pageSize: 25,
        sortOrder: "desc",
        action: "contractor.created",
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty("action", "contractor.created");
    });

    it("filters by resourceType when provided", async () => {
      await caller.audit.list({
        page: 1,
        pageSize: 25,
        sortOrder: "desc",
        resourceType: "Invoice",
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty("resourceType", "Invoice");
    });

    it("filters by date range when dateFrom/dateTo provided", async () => {
      await caller.audit.list({
        page: 1,
        pageSize: 25,
        sortOrder: "desc",
        dateFrom: "2025-01-01",
        dateTo: "2025-06-30",
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where.createdAt).toEqual({
        gte: new Date("2025-01-01"),
        lte: new Date("2025-06-30"),
      });
    });

    it("supports asc/desc sort order on createdAt", async () => {
      await caller.audit.list({
        page: 1,
        pageSize: 25,
        sortOrder: "asc",
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.orderBy).toEqual({ createdAt: "asc" });
    });

    it("requires settings.read permission (admin-only per D-13)", async () => {
      const unauthCaller = createCaller({
        headers: new Headers(),
        session: null,
        user: null,
      });

      await expect(
        unauthCaller.audit.list({ page: 1, pageSize: 25, sortOrder: "desc" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  // =========================================================================
  // actors
  // =========================================================================

  describe("actors", () => {
    it("returns distinct actors for filter dropdown", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { actorId: "user-1", actorName: "Alice" },
        { actorId: "user-2", actorName: "Bob" },
        { actorId: null, actorName: "System" },
      ]);

      const result = await caller.audit.actors();

      // null actorId entries are filtered out
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { id: "user-1", name: "Alice" },
        { id: "user-2", name: "Bob" },
      ]);

      // Verify distinct query scoped to org
      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty("organizationId", ORG_ID);
      expect(call?.distinct).toEqual(["actorId"]);
      expect(call?.select).toEqual({ actorId: true, actorName: true });
    });
  });

  // =========================================================================
  // export
  // =========================================================================

  describe("export", () => {
    it("returns base64 CSV with all matching rows (up to 10000 limit)", async () => {
      const entries = [
        { id: "audit-1", action: "contractor.created", createdAt: new Date() },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(entries);

      const result = await caller.audit.export({});

      expect(result).toHaveProperty("data", "bW9ja0NTVg==");
      expect(result).toHaveProperty("mimeType", "text/csv;charset=utf-8");

      // Verify take limit
      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.take).toBe(10000);
      expect(call?.orderBy).toEqual({ createdAt: "desc" });

      // generateAuditCsv was called with the entries
      expect(mockGenerateAuditCsv).toHaveBeenCalledWith(entries);
    });

    it("applies same filters as list query", async () => {
      await caller.audit.export({
        search: "payment",
        actorId: "user-abc",
        action: "invoice.paid",
        resourceType: "Invoice",
        dateFrom: "2025-03-01",
        dateTo: "2025-03-31",
      });

      const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty("organizationId", ORG_ID);
      expect(call?.where).toHaveProperty("actorId", "user-abc");
      expect(call?.where).toHaveProperty("action", "invoice.paid");
      expect(call?.where).toHaveProperty("resourceType", "Invoice");
      expect(call?.where.createdAt).toEqual({
        gte: new Date("2025-03-01"),
        lte: new Date("2025-03-31"),
      });
      expect(call?.where.OR).toEqual([
        { actorName: { contains: "payment", mode: "insensitive" } },
        { resourceName: { contains: "payment", mode: "insensitive" } },
        { action: { contains: "payment", mode: "insensitive" } },
      ]);
    });

    it("filename includes current date: audit-log-YYYY-MM-DD.csv", async () => {
      const result = await caller.audit.export({});

      // Filename should match pattern audit-log-YYYY-MM-DD.csv
      expect(result.filename).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });
});
