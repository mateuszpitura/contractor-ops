/**
 * Calendar router tests — connections, disconnect, events count, task template config.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const ORG_ID = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
const USER_ID = "clyyyyyyyyyyyyyyyyyyyyyyyy";
const OTHER_USER_ID = "clotheruser0000000000000001";
const CONN_ID = "clconnect0000000000000001";
const TASK_TEMPLATE_ID = "cltemplate0000000000000001";

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    $queryRaw: vi.fn(),
    notification: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    userNotificationPreference: {
      upsert: vi.fn(async (opts: { where: Rec; create: Rec }) => opts.create),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: "admin" })),
    },
    integrationConnection: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    externalLink: {
      count: vi.fn(async () => 0),
    },
    workflowTaskTemplate: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    reminderRule: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Rec }) => ({ id: "rule-new", ...data })),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ where, data }: { where: Rec; data: Rec }) => ({
        id: where.id,
        ...data,
      })),
      delete: vi.fn(async ({ where }: { where: Rec }) => ({ id: where.id })),
    },
    reminderInstance: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

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

vi.mock("../../services/teams/teams-graph-client.js", () => ({
  getTeamsChannels: vi.fn(async () => []),
  getJoinedTeams: vi.fn(async () => []),
  getUserByEmail: vi.fn(async () => null),
}));

vi.mock("../../services/notification-service.js", () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async (_uid: string, _oid: string, type: string) => ({
    notificationType: type,
    channelEmail: true,
    channelSlack: false,
    channelInApp: true,
  })),
}));

vi.mock("../../services/r2.js", () => ({
  createPresignedUploadUrl: vi.fn(async () => ({ url: "https://r2.example.com/upload", key: "mock-key" })),
  createPresignedDownloadUrl: vi.fn(async () => "https://r2.example.com/download"),
  generateStorageKey: vi.fn(() => "mock-storage-key"),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock("../../services/cache.js", () => ({
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
  generateAuditCsv: vi.fn(async () => ({ base64: "bW9jaw==", filename: "audit.csv" })),
}));

vi.mock("../../services/billing-service.js", () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
  getSubscription: vi.fn(async () => ({
    id: "sub_cal_mock",
    status: "ACTIVE",
    tier: "PRO",
  })),
  createCheckoutSession: vi.fn(async () => ({ url: "https://stripe.test/checkout" })),
  createPortalSession: vi.fn(async () => ({})),
  getProrationPreview: vi.fn(async () => ({})),
  ensureStripeCustomer: vi.fn(async () => "cus_mock"),
  createTopUpCheckoutSession: vi.fn(async () => ({})),
  updateSubscriptionSeatCount: vi.fn(async () => undefined),
}));

vi.mock("../../services/billing-constants.js", () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set(["price_starter_monthly"]),
  KNOWN_TOPUP_PRICE_IDS: new Set(["price_topup_10"]),
}));

vi.mock("../../services/portal-change-request.js", () => ({
  approveChangeRequest: vi.fn(async () => undefined),
  rejectChangeRequest: vi.fn(async () => undefined),
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
  getCreditBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
  checkAndDeductCredit: vi.fn(async () => true),
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
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
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

import { createCallerFactory } from "../../init.js";
import { appRouter } from "../../root.js";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
});

describe("calendar router", () => {
  it("listConnections queries org calendar providers and user or org-wide connections", async () => {
    mockPrisma.integrationConnection.findMany.mockResolvedValueOnce([
      {
        id: CONN_ID,
        provider: "GOOGLE_CALENDAR",
        status: "CONNECTED",
        displayName: "Work",
        connectedAt: new Date("2026-01-01"),
        userId: USER_ID,
        tokenExpiresAt: null,
      },
    ]);

    const rows = await caller.calendar.listConnections();

    expect(mockPrisma.integrationConnection.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        provider: { in: ["GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"] },
        OR: [{ userId: USER_ID }, { userId: null }],
      },
      select: {
        id: true,
        provider: true,
        status: true,
        displayName: true,
        connectedAt: true,
        userId: true,
        tokenExpiresAt: true,
      },
      orderBy: { connectedAt: "desc" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provider).toBe("GOOGLE_CALENDAR");
  });

  it("listPersonalConnections scopes to current user", async () => {
    await caller.calendar.listPersonalConnections();

    expect(mockPrisma.integrationConnection.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        userId: USER_ID,
        provider: { in: ["GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"] },
      },
      select: {
        id: true,
        provider: true,
        status: true,
        displayName: true,
        connectedAt: true,
        userId: true,
        tokenExpiresAt: true,
      },
      orderBy: { connectedAt: "desc" },
    });
  });

  it("disconnect throws NOT_FOUND when connection missing", async () => {
    await expect(caller.calendar.disconnect({ connectionId: CONN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockPrisma.integrationConnection.update).not.toHaveBeenCalled();
  });

  it("disconnect throws FORBIDDEN for another user's personal connection", async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      organizationId: ORG_ID,
      userId: OTHER_USER_ID,
      provider: "GOOGLE_CALENDAR",
    });

    await expect(caller.calendar.disconnect({ connectionId: CONN_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("disconnect sets status DISCONNECTED for own personal connection", async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      organizationId: ORG_ID,
      userId: USER_ID,
      provider: "GOOGLE_CALENDAR",
    });

    await caller.calendar.disconnect({ connectionId: CONN_ID });

    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: CONN_ID },
      data: { status: "DISCONNECTED" },
    });
  });

  it("listEvents returns externalLink count for calendar event types", async () => {
    mockPrisma.externalLink.count.mockResolvedValueOnce(4);

    const out = await caller.calendar.listEvents();

    expect(mockPrisma.externalLink.count).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        externalType: { in: ["GOOGLE_CALENDAR_EVENT", "OUTLOOK_CALENDAR_EVENT"] },
      },
    });
    expect(out).toEqual({ count: 4 });
  });

  it("getTaskConfig returns defaults when template missing or empty", async () => {
    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValueOnce(null);

    const a = await caller.calendar.getTaskConfig({ taskTemplateId: TASK_TEMPLATE_ID });
    expect(a).toEqual({ calendarEnabled: false, duration: "1h", attendees: [] });

    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValueOnce({
      configJson: { notCalendar: true },
    });

    const b = await caller.calendar.getTaskConfig({ taskTemplateId: TASK_TEMPLATE_ID });
    expect(b).toEqual({ calendarEnabled: false, duration: "1h", attendees: [] });
  });

  it("getTaskConfig parses valid calendarTaskConfigSchema from configJson", async () => {
    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValueOnce({
      configJson: {
        calendarEnabled: true,
        titleTemplate: "{{name}}",
        duration: "2h",
        attendees: ["a@example.com"],
      },
    });

    const cfg = await caller.calendar.getTaskConfig({ taskTemplateId: TASK_TEMPLATE_ID });

    expect(cfg).toEqual({
      calendarEnabled: true,
      titleTemplate: "{{name}}",
      duration: "2h",
      attendees: ["a@example.com"],
    });
  });

  it("saveTaskConfig throws NOT_FOUND when template not in org", async () => {
    mockPrisma.workflowTaskTemplate.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.calendar.saveTaskConfig({
        taskTemplateId: TASK_TEMPLATE_ID,
        config: {
          calendarEnabled: true,
          titleTemplate: "T",
          duration: "1h",
          attendees: [],
        },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("saveTaskConfig merges calendar fields into configJson", async () => {
    mockPrisma.workflowTaskTemplate.findFirst.mockResolvedValueOnce({
      configJson: { jira: { project: "X" } },
    });

    await caller.calendar.saveTaskConfig({
      taskTemplateId: TASK_TEMPLATE_ID,
      config: {
        calendarEnabled: true,
        titleTemplate: "Due",
        duration: "30m",
        attendees: ["fin@example.com"],
      },
    });

    expect(mockPrisma.workflowTaskTemplate.update).toHaveBeenCalledWith({
      where: { id: TASK_TEMPLATE_ID },
      data: {
        configJson: {
          jira: { project: "X" },
          calendarEnabled: true,
          titleTemplate: "Due",
          duration: "30m",
          attendees: ["fin@example.com"],
        },
      },
    });
  });

  describe("tier gating", () => {
    it("disconnect and saveTaskConfig include requireTier(PRO)", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sourceDir = path.resolve(import.meta.dirname, "../../routers");
      const source = fs.readFileSync(
        path.join(sourceDir, "calendar.ts"),
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
        path.join(sourceDir, "calendar.ts"),
        "utf-8",
      );

      for (const proc of ["listConnections", "listPersonalConnections", "listEvents", "getTaskConfig"]) {
        const procRegex = new RegExp(`${proc}:\\s*tenantProcedure[\\s\\S]*?(?=\\w+:\\s*tenantProcedure|\\}\\);$)`, "m");
        const match = source.match(procRegex);
        if (match) {
          expect(match[0]).not.toContain("requireTier");
        }
      }
    });
  });
});
