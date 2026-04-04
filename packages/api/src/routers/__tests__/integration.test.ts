/**
 * Integration router tests — getOAuthUrlGeneric.
 *
 * Tests the generic OAuth URL generation that works across providers
 * (Google Calendar, Outlook Calendar, etc.). Verifies URL construction,
 * scope joining, and extra auth params.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "org-integ-001";
const USER_ID = "user-integ-001";

// ---------------------------------------------------------------------------
// Mock via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockGetAdapter, mockGenerateOAuthState } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    integrationConnection: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    externalLink: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    member: {
      findMany: vi.fn(),
    },
    integrationSyncLog: {
      findMany: vi.fn(),
    },
    webhookDelivery: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockGetAdapter: vi.fn(),
    mockGenerateOAuthState: vi.fn(() => "hmac-signed-state"),
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

vi.mock("@contractor-ops/integrations", () => ({
  getProviderHealth: vi.fn(async () => ({})),
  getAllProviderHealth: vi.fn(async () => []),
  getAdapter: mockGetAdapter,
  generateOAuthState: mockGenerateOAuthState,
  registerAllAdapters: vi.fn(),
}));

vi.mock("@contractor-ops/validators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contractor-ops/validators")>();
  return {
    ...actual,
    slackUserLinkSchema: { parse: vi.fn((v: unknown) => v) },
    slackUserUnlinkSchema: { parse: vi.fn((v: unknown) => v) },
    providerSlugSchema: { parse: vi.fn((v: unknown) => v) },
    disconnectProviderSchema: { parse: vi.fn((v: unknown) => v) },
    getSyncLogSchema: { parse: vi.fn((v: unknown) => v) },
    getWebhookLogSchema: { parse: vi.fn((v: unknown) => v) },
  };
});

vi.mock("../../services/slack-client.js", () => ({
  syncWorkspaceUsers: vi.fn(),
}));

vi.mock("../../services/portal-session.js", () => ({
  validatePortalSession: vi.fn(),
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
      id: "session-integ",
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
      name: "Integration Admin",
      email: "admin@test.com",
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

const caller = makeTenantCaller();

// ---------------------------------------------------------------------------
// Reset + Env
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Set required env vars
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test.com";
});

// ===========================================================================
// getOAuthUrlGeneric
// ===========================================================================

describe("integration.getOAuthUrlGeneric", () => {
  function setupGoogleCalendarAdapter() {
    mockGetAdapter.mockReturnValue({
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientIdEnvVar: "GOOGLE_CLIENT_ID",
        clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        redirectPath: "/api/integrations/google-calendar/callback",
        scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"],
        extraAuthParams: { access_type: "offline", prompt: "consent" },
      }),
    });
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  }

  function setupOutlookAdapter() {
    mockGetAdapter.mockReturnValue({
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientIdEnvVar: "OUTLOOK_CLIENT_ID",
        clientSecretEnvVar: "OUTLOOK_CLIENT_SECRET",
        authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        redirectPath: "/api/integrations/outlook/callback",
        scopes: ["Calendars.ReadWrite", "offline_access"],
        extraAuthParams: null,
      }),
    });
    process.env.OUTLOOK_CLIENT_ID = "outlook-client-id";
    process.env.OUTLOOK_CLIENT_SECRET = "outlook-client-secret";
  }

  it("joins scopes with space separator, not comma", async () => {
    setupGoogleCalendarAdapter();

    const result = await caller.integration.getOAuthUrlGeneric({
      provider: "google-calendar",
    });

    const url = new URL(result.url);
    const scopeParam = url.searchParams.get("scope");
    expect(scopeParam).toBe(
      "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
    );
    // Should NOT contain commas
    expect(scopeParam).not.toContain(",");
  });

  it("includes response_type=code in authorization URL params", async () => {
    setupGoogleCalendarAdapter();

    const result = await caller.integration.getOAuthUrlGeneric({
      provider: "google-calendar",
    });

    const url = new URL(result.url);
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("appends extraAuthParams from adapter OAuthConfig to URL", async () => {
    setupGoogleCalendarAdapter();

    const result = await caller.integration.getOAuthUrlGeneric({
      provider: "google-calendar",
    });

    const url = new URL(result.url);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("Google Calendar URL includes access_type=offline and prompt=consent", async () => {
    setupGoogleCalendarAdapter();

    const result = await caller.integration.getOAuthUrlGeneric({
      provider: "google-calendar",
    });

    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.test.com/api/integrations/google-calendar/callback",
    );
  });

  it("Outlook Calendar URL uses correct authorizationUrl from adapter config", async () => {
    setupOutlookAdapter();

    const result = await caller.integration.getOAuthUrlGeneric({
      provider: "outlook-calendar",
    });

    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("outlook-client-id");
    expect(url.searchParams.get("scope")).toBe("Calendars.ReadWrite offline_access");
  });
});
