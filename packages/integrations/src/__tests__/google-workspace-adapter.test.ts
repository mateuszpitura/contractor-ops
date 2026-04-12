import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleWorkspaceAdapter } from "../adapters/google-workspace-adapter.js";

function mockFetch(
  responses: Array<{
    ok: boolean;
    status: number;
    body: unknown;
  }>,
) {
  const fn = vi.fn();
  let i = 0;
  fn.mockImplementation(() => {
    const r = responses[i] ?? responses[responses.length - 1]!;
    i += 1;
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      text: () => Promise.resolve(typeof r.body === "string" ? r.body : JSON.stringify(r.body)),
      json: () => Promise.resolve(r.body),
    });
  });
  return fn;
}

describe("GoogleWorkspaceAdapter", () => {
  let adapter: GoogleWorkspaceAdapter;

  beforeEach(() => {
    adapter = new GoogleWorkspaceAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    delete process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
  });

  describe("OAuth configuration", () => {
    it("returns Admin SDK scopes and offline consent extras", () => {
      const c = adapter.getOAuthConfig();
      expect(c.clientIdEnvVar).toBe("GOOGLE_WORKSPACE_CLIENT_ID");
      expect(c.clientSecretEnvVar).toBe("GOOGLE_WORKSPACE_CLIENT_SECRET");
      expect(c.scopes).toContain("https://www.googleapis.com/auth/admin.directory.user.readonly");
      expect(c.scopes).toContain("https://www.googleapis.com/auth/admin.directory.group.readonly");
      expect(c.extraAuthParams?.access_type).toBe("offline");
      expect(c.extraAuthParams?.prompt).toBe("consent");
    });

    it("has slug google_workspace, display name, OAuth on, webhooks off", () => {
      expect(adapter.slug).toBe("google_workspace");
      expect(adapter.displayName).toBe("Google Workspace");
      expect(adapter.supportsOAuth).toBe(true);
      expect(adapter.supportsWebhooks).toBe(false);
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges authorization code for access and refresh tokens", async () => {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = "gw-id";
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "gw-secret";

      const fetchMock = mockFetch([
        {
          ok: true,
          status: 200,
          body: {
            access_token: "at",
            refresh_token: "rt",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "admin.directory.user.readonly",
          },
        },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      const out = await adapter.exchangeCodeForTokens("code", "http://localhost/cb");

      expect(out.accessToken).toBe("at");
      expect(out.refreshToken).toBe("rt");
      const [, init] = fetchMock.mock.calls[0]!;
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.client_id).toBe("gw-id");
      expect(body.grant_type).toBe("authorization_code");
    });

    it("throws on non-ok response from Google token endpoint", async () => {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = "gw-id";
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "gw-secret";

      const fetchMock = mockFetch([{ ok: false, status: 400, body: { error: "invalid_grant" } }]);
      vi.stubGlobal("fetch", fetchMock);

      await expect(adapter.exchangeCodeForTokens("bad", "http://localhost/cb")).rejects.toThrow(
        /Google Workspace OAuth exchange failed/,
      );
    });
  });

  describe("refreshToken", () => {
    it("refreshes access token using refresh_token grant", async () => {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = "gw-id";
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "gw-secret";

      const fetchMock = mockFetch([
        {
          ok: true,
          status: 200,
          body: {
            access_token: "new-at",
            expires_in: 7200,
            token_type: "Bearer",
            scope: "x",
          },
        },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      const out = await adapter.refreshToken({
        accessToken: "old",
        refreshToken: "rt-keep",
        tokenType: "Bearer",
        scope: "x",
      });

      expect(out.accessToken).toBe("new-at");
      expect(out.refreshToken).toBe("rt-keep");
      const [, init] = fetchMock.mock.calls[0]!;
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.grant_type).toBe("refresh_token");
    });

    it("throws on non-ok response from Google token endpoint", async () => {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = "gw-id";
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "gw-secret";

      const fetchMock = mockFetch([{ ok: false, status: 401, body: "unauthorized" }]);
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        adapter.refreshToken({
          accessToken: "a",
          refreshToken: "rt",
          tokenType: "Bearer",
          scope: "x",
        }),
      ).rejects.toThrow(/Google Workspace token refresh failed/);
    });
  });
});
