/** @vitest-environment node */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAdapter,
  mockVerifyOAuthState,
  mockEncryptCredentials,
  mockFindFirst,
  mockCreate,
  mockUpdate,
} = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockVerifyOAuthState: vi.fn(),
  mockEncryptCredentials: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@contractor-ops/integrations", () => ({
  registerAllAdapters: vi.fn(),
  getAdapter: (slug: string) => mockGetAdapter(slug),
  verifyOAuthState: (stateParam: string, provider: string, signingSecret: string) =>
    mockVerifyOAuthState(stateParam, provider, signingSecret),
  encryptCredentials: (credentials: unknown, provider: string) =>
    mockEncryptCredentials(credentials, provider),
}));

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    integrationConnection: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { GET } from "../route";

function slackAdapter() {
  const exchangeCodeForTokens = vi.fn().mockResolvedValue({
    accessToken: "xoxb-1",
    tokenType: "bearer",
    extra: { teamName: "Acme Workspace" },
  });
  return {
    slug: "slack",
    displayName: "Slack",
    supportsOAuth: true,
    getOAuthConfig: () => ({
      clientIdEnvVar: "SLACK_CLIENT_ID",
      clientSecretEnvVar: "SLACK_CLIENT_SECRET",
      authorizationUrl: "https://slack.com/oauth",
      tokenUrl: "https://slack.com/token",
      scopes: ["chat:write"],
      redirectPath: "/api/oauth/slack/callback",
    }),
    exchangeCodeForTokens,
  };
}

describe("GET /api/oauth/[provider]/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost";
    process.env.SLACK_CLIENT_SECRET = "slack-secret";
    mockEncryptCredentials.mockReturnValue("encrypted-org-1/slack");
    mockVerifyOAuthState.mockReturnValue({
      orgId: "org-1",
      userId: "user-1",
    });
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-conn" });
    mockUpdate.mockResolvedValue({ id: "upd-conn" });
  });

  it("redirects with error when code or state is missing", async () => {
    mockGetAdapter.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/oauth/jira/callback");
    const res = await GET(req, {
      params: Promise.resolve({ provider: "jira" }),
    });
    expect([302, 307]).toContain(res.status);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("tab=integrations");
    expect(loc).toContain("jira=error");
  });

  it("redirects with error when no OAuth adapter is registered for provider", async () => {
    mockGetAdapter.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/oauth/unknown/callback?code=abc&state=xyz");
    const res = await GET(req, {
      params: Promise.resolve({ provider: "unknown" }),
    });
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toContain("unknown=error");
  });

  it("redirects with error when client secret env var is missing", async () => {
    mockGetAdapter.mockReturnValue(slackAdapter());
    delete process.env.SLACK_CLIENT_SECRET;

    const req = new NextRequest("http://localhost/api/oauth/slack/callback?code=c1&state=s1");
    const res = await GET(req, {
      params: Promise.resolve({ provider: "slack" }),
    });
    expect(res.headers.get("location")).toContain("slack=error");
    expect(mockVerifyOAuthState).not.toHaveBeenCalled();
  });

  it("redirects with error when OAuth state verification fails", async () => {
    mockGetAdapter.mockReturnValue(slackAdapter());
    mockVerifyOAuthState.mockReturnValue(null);

    const req = new NextRequest("http://localhost/api/oauth/slack/callback?code=c1&state=s1");
    const res = await GET(req, {
      params: Promise.resolve({ provider: "slack" }),
    });
    expect(res.headers.get("location")).toContain("slack=error");
  });

  it("creates IntegrationConnection and redirects on success (new connection)", async () => {
    const adapter = slackAdapter();
    mockGetAdapter.mockReturnValue(adapter);

    const req = new NextRequest(
      "http://localhost/api/oauth/slack/callback?code=auth-code&state=signed-state",
    );
    const res = await GET(req, {
      params: Promise.resolve({ provider: "slack" }),
    });

    expect(res.headers.get("location")).toBe(
      "http://localhost/settings?tab=integrations&slack=connected",
    );
    expect(adapter.exchangeCodeForTokens).toHaveBeenCalledWith(
      "auth-code",
      "http://localhost/api/oauth/slack/callback",
    );
    expect(mockEncryptCredentials).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          provider: "SLACK",
          status: "CONNECTED",
          displayName: "Acme Workspace",
          credentialsRef: "encrypted-org-1/slack",
          connectedByUserId: "user-1",
        }),
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates existing IntegrationConnection when one exists", async () => {
    const adapter = slackAdapter();
    mockGetAdapter.mockReturnValue(adapter);
    mockFindFirst.mockResolvedValue({ id: "conn-existing" });

    const req = new NextRequest("http://localhost/api/oauth/slack/callback?code=c&state=s");
    await GET(req, { params: Promise.resolve({ provider: "slack" }) });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "conn-existing" },
      data: expect.objectContaining({
        status: "CONNECTED",
        displayName: "Acme Workspace",
      }),
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("uses PENDING_MAPPING for Linear provider", async () => {
    const exchangeCodeForTokens = vi.fn().mockResolvedValue({
      accessToken: "lin-token",
      tokenType: "Bearer",
      extra: {},
    });
    mockGetAdapter.mockReturnValue({
      slug: "linear",
      displayName: "Linear",
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientSecretEnvVar: "LINEAR_CLIENT_SECRET",
        authorizationUrl: "https://linear.app/oauth",
        tokenUrl: "https://api.linear.app/oauth/token",
        scopes: ["read"],
        redirectPath: "/cb",
      }),
      exchangeCodeForTokens,
    });
    process.env.LINEAR_CLIENT_SECRET = "linear-sec";

    const req = new NextRequest("http://localhost/api/oauth/linear/callback?code=c&state=s");
    await GET(req, { params: Promise.resolve({ provider: "linear" }) });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "LINEAR",
          status: "PENDING_MAPPING",
        }),
      }),
    );
  });

  it("redirects with error when exchangeCodeForTokens throws", async () => {
    const adapter = slackAdapter();
    adapter.exchangeCodeForTokens.mockRejectedValue(new Error("oauth down"));
    mockGetAdapter.mockReturnValue(adapter);

    const req = new NextRequest("http://localhost/api/oauth/slack/callback?code=c&state=s");
    const res = await GET(req, {
      params: Promise.resolve({ provider: "slack" }),
    });
    expect(res.headers.get("location")).toContain("slack=error");
  });
});
