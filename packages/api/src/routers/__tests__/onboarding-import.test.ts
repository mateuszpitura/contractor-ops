/**
 * Onboarding Import router — listSources, fetchPeople, fetchProjects,
 * startImport, getProgress, retryFailedItem.
 *
 * Mocks: prisma, auth, linearGraphQL, global.fetch (Jira + Slack API).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const ORG_ID = "clorg00000000000000000001";
const USER_ID = "cluser0000000000000000001";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockLinearGraphQL,
  mockCreateInvitation,
  mockGetFullOrganization,
  mockFetch,
  mockGetSubscription,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPrisma: Record<string, any> = {
    integrationConnection: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    member: {
      findMany: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workflowTemplate: {
      create: vi.fn(),
    },
    workflowTaskTemplate: {
      createMany: vi.fn(),
    },
  };

  const mockLinearGraphQL = vi.fn();
  const mockCreateInvitation = vi.fn(async () => ({ id: "inv-1" }));
  const mockGetFullOrganization = vi.fn(async () => ({
    members: [
      { user: { email: "existing@example.com" } },
    ],
  }));
  const mockFetch = vi.fn();

  const mockGetSubscription = vi.fn(async () => ({
    id: "sub_onb_mock",
    status: "ACTIVE",
    tier: "PRO",
  }));

  return {
    mockPrisma,
    mockLinearGraphQL,
    mockCreateInvitation,
    mockGetFullOrganization,
    mockFetch,
    mockGetSubscription,
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
      createInvitation: mockCreateInvitation,
      getFullOrganization: mockGetFullOrganization,
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("@contractor-ops/logger/metrics", () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock("@contractor-ops/integrations", () => ({
  registerAllAdapters: vi.fn(),
  getAdapter: vi.fn(() => ({
    listAllDirectoryUsers: vi.fn(async () => [
      {
        id: "gw-1",
        primaryEmail: "alice@example.com",
        name: { givenName: "Alice", familyName: "Smith", fullName: "Alice Smith" },
        thumbnailPhotoUrl: null,
        orgUnitPath: "/",
        isAdmin: false,
      },
    ]),
    refreshToken: vi.fn(async (c: unknown) => c),
  })),
  decryptCredentials: vi.fn(() => ({
    accessToken: "access-token",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })),
  encryptCredentials: vi.fn(() => "encrypted-ref"),
}));

vi.mock("@contractor-ops/integrations/services/credential-service", () => ({
  decryptCredentials: vi.fn(() => ({ accessToken: "mock-token" })),
}));

vi.mock("../../services/linear-issue-sync.js", () => ({
  linearGraphQL: (...args: unknown[]) => mockLinearGraphQL(...args),
}));

vi.mock("../../services/cache.js", () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock("../../services/billing-service.js", () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  createCheckoutSession: vi.fn(async () => ({ url: "https://stripe.test/checkout" })),
  createPortalSession: vi.fn(async () => ({})),
  getProrationPreview: vi.fn(async () => ({})),
  ensureStripeCustomer: vi.fn(async () => "cus_mock"),
  createTopUpCheckoutSession: vi.fn(async () => ({})),
  updateSubscriptionSeatCount: vi.fn(async () => undefined),
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

vi.mock("../../services/billing-constants.js", () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set(["price_starter_monthly"]),
  KNOWN_TOPUP_PRICE_IDS: new Set(["price_topup_10"]),
  PRICE_TO_TIER_MAP: {},
}));

// ---------------------------------------------------------------------------
// Import router + caller factory
// ---------------------------------------------------------------------------

import { createCallerFactory } from "../../init.js";
import { onboardingImportRouter } from "../onboarding-import.js";
import { mergeByEmail } from "../../services/onboarding-import-service.js";
import type { SourcePerson } from "../../services/onboarding-import-service.js";

const createCaller = createCallerFactory(onboardingImportRouter);

function makeCaller() {
  const session = {
    session: {
      id: "sess-onb",
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
      name: "Admin",
      email: "admin@example.com",
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

const caller = makeCaller();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test";

  // Default: no connections
  mockPrisma.integrationConnection.findMany.mockResolvedValue([]);
  mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
  mockPrisma.member.findMany.mockResolvedValue([]);
  mockPrisma.organization.findFirst.mockResolvedValue({ id: ORG_ID, settingsJson: {} });
  mockPrisma.organization.update.mockResolvedValue({});

  // Reset global fetch
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("onboardingImport", () => {
  // -------------------------------------------------------------------------
  // listSources
  // -------------------------------------------------------------------------

  it("listSources returns array of 4 sources with provider, connected, selected fields", async () => {
    mockPrisma.integrationConnection.findMany.mockResolvedValue([
      { provider: "JIRA", status: "CONNECTED", credentialsRef: "enc-j" },
      { provider: "SLACK", status: "CONNECTED", credentialsRef: "enc-s" },
    ]);

    const result = await caller.listSources();

    expect(result).toHaveLength(4);
    expect(result.map((s: { provider: string }) => s.provider).sort()).toEqual([
      "GOOGLE_WORKSPACE",
      "JIRA",
      "LINEAR",
      "SLACK",
    ]);

    const jira = result.find((s: { provider: string }) => s.provider === "JIRA");
    expect(jira?.connected).toBe(true);
    expect(jira?.selected).toBe(false);

    const linear = result.find((s: { provider: string }) => s.provider === "LINEAR");
    expect(linear?.connected).toBe(false);
  });

  // -------------------------------------------------------------------------
  // fetchPeople — merge + dedup
  // -------------------------------------------------------------------------

  it("fetchPeople with mixed sources returns merged persons with email dedup (lowercase normalization)", async () => {
    // Jira connected
    mockPrisma.integrationConnection.findFirst
      .mockResolvedValueOnce({
        id: "conn-j",
        provider: "JIRA",
        status: "CONNECTED",
        credentialsRef: "enc-j",
        configJson: { cloudId: "cloud-1" },
      });

    // Jira API returns 2 users, one with uppercase email
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { emailAddress: "Alice@Example.com", displayName: "Alice J", self: "u1", avatarUrls: {} },
        { emailAddress: "bob@example.com", displayName: "Bob J", self: "u2", avatarUrls: {} },
      ],
    });

    mockGetFullOrganization.mockResolvedValue({ members: [] });

    const result = await caller.fetchPeople({ sources: ["JIRA"] });

    // All emails should be normalized to lowercase
    for (const person of result) {
      expect(person.email).toBe(person.email.toLowerCase());
    }
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("fetchPeople detects conflict when same email has different names across sources", async () => {
    const people: SourcePerson[] = [
      { email: "alice@example.com", name: "Alice Smith", source: "JIRA" },
      { email: "alice@example.com", name: "Alice Johnson", source: "LINEAR" },
    ];

    const merged = mergeByEmail(people, new Set());

    expect(merged).toHaveLength(1);
    expect(merged[0]!.status).toBe("conflict");
    expect(merged[0]!.conflicts).toBeDefined();
    expect(merged[0]!.conflicts![0]!.field).toBe("name");
    expect(merged[0]!.conflicts![0]!.values).toHaveLength(2);
  });

  it("fetchPeople marks person as 'exists' when email matches existing org member", async () => {
    const people: SourcePerson[] = [
      { email: "existing@example.com", name: "Existing User", source: "JIRA" },
      { email: "new@example.com", name: "New User", source: "JIRA" },
    ];

    const existingEmails = new Set(["existing@example.com"]);
    const merged = mergeByEmail(people, existingEmails);

    const existing = merged.find((p) => p.email === "existing@example.com");
    expect(existing?.status).toBe("exists");

    const newPerson = merged.find((p) => p.email === "new@example.com");
    expect(newPerson?.status).toBe("new");
  });

  // -------------------------------------------------------------------------
  // Slack bot filtering
  // -------------------------------------------------------------------------

  it("Slack bot users filtered out (is_bot, deleted, is_app_user, USLACKBOT)", async () => {
    const people: SourcePerson[] = [
      { email: "real@example.com", name: "Real User", source: "SLACK" },
    ];

    // Verify mergeByEmail correctly processes only real users
    const merged = mergeByEmail(people, new Set());
    expect(merged).toHaveLength(1);
    expect(merged[0]!.email).toBe("real@example.com");

    // The actual bot filtering happens in fetchUsersFromSource (Slack branch).
    // We verify the service filters correctly by testing the router endpoint
    // which calls fetchUsersFromSource under the hood.
    // Here we verify the Slack fetch path filters bots by checking the mock response.
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: "conn-s",
      provider: "SLACK",
      status: "CONNECTED",
      credentialsRef: "enc-s",
      configJson: {},
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        members: [
          // Real user
          { id: "U1", deleted: false, is_bot: false, is_app_user: false, profile: { email: "real@example.com", real_name: "Real User" } },
          // Bot user - should be filtered
          { id: "U2", deleted: false, is_bot: true, is_app_user: false, profile: { email: "bot@example.com", real_name: "Bot" } },
          // Deleted user - should be filtered
          { id: "U3", deleted: true, is_bot: false, is_app_user: false, profile: { email: "deleted@example.com", real_name: "Deleted" } },
          // App user - should be filtered
          { id: "U4", deleted: false, is_bot: false, is_app_user: true, profile: { email: "app@example.com", real_name: "App" } },
          // Slackbot - should be filtered
          { id: "USLACKBOT", deleted: false, is_bot: false, is_app_user: false, profile: { email: "slackbot@example.com", real_name: "Slackbot" } },
          // No email - should be filtered
          { id: "U5", deleted: false, is_bot: false, is_app_user: false, profile: { real_name: "No Email" } },
        ],
        response_metadata: {},
      }),
    });

    mockGetFullOrganization.mockResolvedValue({ members: [] });

    const result = await caller.fetchPeople({ sources: ["SLACK"] });

    // Only the real user should be returned
    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBe("real@example.com");
  });

  // -------------------------------------------------------------------------
  // fetchProjects
  // -------------------------------------------------------------------------

  it("fetchProjects returns Jira projects and Linear teams with status arrays", async () => {
    // Jira connection
    mockPrisma.integrationConnection.findFirst
      .mockResolvedValueOnce({
        id: "conn-j",
        provider: "JIRA",
        status: "CONNECTED",
        credentialsRef: "enc-j",
        configJson: { cloudId: "cloud-1" },
      })
      // Linear connection
      .mockResolvedValueOnce({
        id: "conn-l",
        provider: "LINEAR",
        status: "CONNECTED",
        credentialsRef: "enc-l",
        configJson: {},
      });

    // Jira projects
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "10001", key: "PRJ", name: "Project Alpha" },
        ],
      })
      // Jira project statuses
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "10001",
            statuses: [
              { id: "1", name: "To Do", statusCategory: { colorName: "blue-gray" } },
              { id: "2", name: "Done", statusCategory: { colorName: "green" } },
            ],
          },
        ],
      });

    // Linear teams
    mockLinearGraphQL.mockResolvedValue({
      teams: {
        nodes: [
          {
            id: "tm1",
            name: "Engineering",
            key: "ENG",
            states: {
              nodes: [
                { id: "st1", name: "Todo", type: "unstarted", color: "#ccc", position: 0 },
                { id: "st2", name: "Done", type: "completed", color: "#0f0", position: 1 },
              ],
            },
          },
        ],
      },
    });

    const result = await caller.fetchProjects({ sources: ["JIRA", "LINEAR"] });

    expect(result.length).toBeGreaterThanOrEqual(2);

    const jiraProject = result.find((p: { sourceProvider: string }) => p.sourceProvider === "JIRA");
    expect(jiraProject).toBeDefined();
    expect(jiraProject!.name).toBe("Project Alpha");
    expect(jiraProject!.statuses.length).toBeGreaterThanOrEqual(1);

    const linearTeam = result.find((p: { sourceProvider: string }) => p.sourceProvider === "LINEAR");
    expect(linearTeam).toBeDefined();
    expect(linearTeam!.name).toBe("Engineering");
    expect(linearTeam!.statuses.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // batchImport / startImport
  // -------------------------------------------------------------------------

  it("batchImport calls createInvitation for each selected person with correct role", async () => {
    mockPrisma.organization.findFirst.mockResolvedValue({ id: ORG_ID, settingsJson: {} });
    mockPrisma.workflowTemplate.create.mockResolvedValue({ id: "tpl-1" });

    const result = await caller.startImport({
      people: [
        { email: "alice@example.com", name: "Alice", role: "admin", skip: false },
        { email: "bob@example.com", name: "Bob", role: "readonly", skip: false },
        { email: "carol@example.com", name: "Carol", role: "admin", skip: true },
      ],
      projects: [],
    });

    expect(result.jobId).toBeDefined();

    // Only non-skipped people should get invitations
    expect(mockCreateInvitation).toHaveBeenCalledTimes(2);
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "alice@example.com",
          role: "admin",
        }),
      }),
    );
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "bob@example.com",
          role: "readonly",
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // importProjects — workflow template creation
  // -------------------------------------------------------------------------

  it("importProjects creates WorkflowTemplate (type: CUSTOM) with WorkflowTaskTemplate per status (taskType: MANUAL)", async () => {
    mockPrisma.organization.findFirst.mockResolvedValue({ id: ORG_ID, settingsJson: {} });
    mockPrisma.workflowTemplate.create.mockResolvedValue({ id: "tpl-1" });
    mockPrisma.workflowTaskTemplate.createMany.mockResolvedValue({ count: 2 });

    await caller.startImport({
      people: [],
      projects: [
        {
          sourceProvider: "JIRA",
          externalId: "10001",
          name: "Project Alpha",
          skip: false,
          steps: [
            { name: "To Do", sortOrder: 0 },
            { name: "Done", sortOrder: 1 },
          ],
        },
      ],
    });

    // Should create a WorkflowTemplate
    expect(mockPrisma.workflowTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CUSTOM",
          status: "DRAFT",
          appliesToEntityType: "CONTRACTOR",
        }),
      }),
    );

    // Should create WorkflowTaskTemplates
    expect(mockPrisma.workflowTaskTemplate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            taskType: "MANUAL",
            assigneeMode: "ROLE_BASED",
            required: true,
          }),
        ]),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // startImport + getProgress
  // -------------------------------------------------------------------------

  it("startImport returns jobId, getProgress returns completedItems/failedItems", async () => {
    mockPrisma.organization.findFirst.mockResolvedValue({ id: ORG_ID, settingsJson: {} });

    const importResult = await caller.startImport({
      people: [
        { email: "alice@example.com", name: "Alice", role: "admin", skip: false },
      ],
      projects: [],
    });

    expect(importResult.jobId).toBeDefined();

    // Mock getProgress reading from org settingsJson
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      settingsJson: {
        importJobs: {
          [importResult.jobId]: {
            jobId: importResult.jobId,
            status: "completed",
            totalItems: 1,
            completedItems: 1,
            failedItems: [],
          },
        },
      },
    });

    const progress = await caller.getProgress({ jobId: importResult.jobId });

    expect(progress.jobId).toBe(importResult.jobId);
    expect(progress.status).toBe("completed");
    expect(progress.completedItems).toBe(1);
    expect(progress.failedItems).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // retryFailedItem
  // -------------------------------------------------------------------------

  it("retryFailedItem re-processes single item without affecting others", async () => {
    const jobId = "job-retry-1";

    mockPrisma.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      settingsJson: {
        importJobs: {
          [jobId]: {
            jobId,
            status: "completed",
            totalItems: 2,
            completedItems: 1,
            failedItems: [
              { email: "fail@example.com", error: "Already exists" },
              { email: "fail2@example.com", error: "Invalid email" },
            ],
          },
        },
      },
    });

    mockCreateInvitation.mockResolvedValueOnce({ id: "inv-retry" });

    const result = await caller.retryFailedItem({
      jobId,
      email: "fail@example.com",
    });

    expect(result.success).toBe(true);

    // Should have called createInvitation for only the retried email
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: "fail@example.com" }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // mergeByEmail — unit tests
  // -------------------------------------------------------------------------

  describe("mergeByEmail", () => {
    it("groups people by lowercase email", () => {
      const people: SourcePerson[] = [
        { email: "Alice@Example.com", name: "Alice S", source: "JIRA" },
        { email: "alice@example.com", name: "Alice S", source: "LINEAR" },
      ];

      const merged = mergeByEmail(people, new Set());

      expect(merged).toHaveLength(1);
      expect(merged[0]!.email).toBe("alice@example.com");
      expect(merged[0]!.sources).toHaveLength(2);
      expect(merged[0]!.status).toBe("new");
    });

    it("sorts by status priority: conflicts first, then new, then exists", () => {
      const people: SourcePerson[] = [
        { email: "conflict@example.com", name: "Alice A", source: "JIRA" },
        { email: "conflict@example.com", name: "Alice B", source: "LINEAR" },
        { email: "new@example.com", name: "New User", source: "JIRA" },
        { email: "existing@example.com", name: "Existing", source: "JIRA" },
      ];

      const existingEmails = new Set(["existing@example.com"]);
      const merged = mergeByEmail(people, existingEmails);

      expect(merged[0]!.status).toBe("conflict");
      expect(merged[1]!.status).toBe("new");
      expect(merged[2]!.status).toBe("exists");
    });
  });

  // -------------------------------------------------------------------------
  // Tier gating
  // -------------------------------------------------------------------------

  describe("tier gating", () => {
    beforeEach(() => {
      mockGetSubscription.mockResolvedValue({
        id: "sub_starter",
        status: "ACTIVE",
        tier: "STARTER",
      });
    });

    it("listSources rejects STARTER tier with TIER_REQUIRED error", async () => {
      await expect(caller.listSources()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      await expect(caller.listSources()).rejects.toThrow(/TIER_REQUIRED/);
    });

    it("startImport rejects STARTER tier with TIER_REQUIRED error", async () => {
      await expect(
        caller.startImport({
          people: [{ email: "a@example.com", name: "A", role: "readonly", skip: false }],
          projects: [],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("fetchPeople rejects STARTER tier with TIER_REQUIRED error", async () => {
      await expect(
        caller.fetchPeople({ sources: ["JIRA"] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getProgress rejects STARTER tier with TIER_REQUIRED error", async () => {
      await expect(
        caller.getProgress({ jobId: "job-1" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
