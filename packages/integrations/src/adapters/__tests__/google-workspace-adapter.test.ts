import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleWorkspaceAdapter } from "../google-workspace-adapter.js";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    integrationConnection: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    integrationSyncLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

function mockFetch(response: { ok: boolean; status?: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    text: () =>
      Promise.resolve(
        typeof response.body === "string" ? response.body : JSON.stringify(response.body),
      ),
    json: () => Promise.resolve(response.body),
  });
}

describe("GoogleWorkspaceAdapter", () => {
  let adapter: GoogleWorkspaceAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GoogleWorkspaceAdapter();
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    delete process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
  });

  it("returns OAuthConfig with Admin SDK scopes and google_workspace callback path", () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(c.tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(c.scopes).toEqual([
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
      "https://www.googleapis.com/auth/admin.directory.group.readonly",
    ]);
    expect(c.redirectPath).toBe("/api/oauth/google_workspace/callback");
    expect(c.extraAuthParams?.access_type).toBe("offline");
    expect(c.extraAuthParams?.prompt).toBe("consent");
  });

  it("throws when OAuth env vars are missing for exchangeCodeForTokens", async () => {
    await expect(adapter.exchangeCodeForTokens("code", "http://localhost/cb")).rejects.toThrow(
      /GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET environment variables are required/,
    );
  });

  it("exchanges code for tokens via JSON POST to Google token endpoint", async () => {
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "cid";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "admin.directory.user.readonly",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.exchangeCodeForTokens("code", "http://localhost/cb");

    expect(out.accessToken).toBe("at");
    expect(out.refreshToken).toBe("rt");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.grant_type).toBe("authorization_code");
    expect(body.redirect_uri).toBe("http://localhost/cb");
  });

  it("throws when OAuth exchange returns non-OK", async () => {
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "cid";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: false,
      status: 400,
      body: "invalid_grant",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.exchangeCodeForTokens("bad", "http://localhost/cb")).rejects.toThrow(
      /Google Workspace OAuth exchange failed: invalid_grant/,
    );
  });

  it("throws when refresh env is missing", async () => {
    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: "r",
        tokenType: "Bearer",
        scope: "s",
        expiresAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(
      /GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET environment variables are required/,
    );
  });

  it("throws when refreshToken credential is missing", async () => {
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "cid";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "csec";

    await expect(
      adapter.refreshToken({
        accessToken: "a",
        tokenType: "Bearer",
        scope: "s",
        expiresAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/No refresh token available for Google Workspace/);
  });

  it("refreshes access token and keeps the same refresh token", async () => {
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "cid";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "new-at",
        expires_in: 1800,
        token_type: "Bearer",
        scope: "admin.directory.user.readonly",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.refreshToken({
      accessToken: "old",
      refreshToken: "rt-persist",
      tokenType: "Bearer",
      scope: "s",
      expiresAt: new Date().toISOString(),
    });

    expect(out.accessToken).toBe("new-at");
    expect(out.refreshToken).toBe("rt-persist");
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.grant_type).toBe("refresh_token");
  });

  it("throws when token refresh returns non-OK", async () => {
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "cid";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      body: "bad",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: "r",
        tokenType: "Bearer",
        scope: "s",
        expiresAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Google Workspace token refresh failed: bad/);
  });

  it("lists directory users, skips suspended, and follows nextPageToken", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          users: [
            {
              id: "1",
              primaryEmail: "a@x.com",
              name: { givenName: "A", familyName: "B", fullName: "A B" },
              suspended: false,
            },
            {
              id: "2",
              primaryEmail: "gone@x.com",
              name: { givenName: "G", familyName: "O", fullName: "G O" },
              suspended: true,
            },
          ],
          nextPageToken: "tok2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          users: [
            {
              id: "3",
              primaryEmail: "c@x.com",
              name: { givenName: "C", familyName: "D", fullName: "C D" },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const users = await adapter.listAllDirectoryUsers("access");

    expect(users).toHaveLength(2);
    expect(users.map((u) => u.id)).toEqual(["1", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0]![0] as string;
    expect(firstUrl).toContain("admin.googleapis.com/admin/directory/v1/users");
    expect(firstUrl).toContain("customer=my_customer");
    const secondUrl = fetchMock.mock.calls[1]![0] as string;
    expect(secondUrl).toContain("pageToken=tok2");
  });

  it("throws when Directory API returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 403,
      body: "forbidden",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.listAllDirectoryUsers("t")).rejects.toThrow(
      /Google Workspace Directory API failed \(403\): forbidden/,
    );
  });

  it("returns empty groups when API responds 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "",
        json: async () => ({}),
      }),
    );

    const groups = await adapter.listUserGroups("tok", "user@example.com");

    expect(groups).toEqual([]);
  });

  it("lists groups with pagination", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          groups: [{ id: "g1", email: "a@groups", name: "A" }],
          nextPageToken: "pg2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          groups: [{ id: "g2", email: "b@groups", name: "B" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const groups = await adapter.listUserGroups("tok", "u@x.com");

    expect(groups).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0]![0] as string;
    expect(firstUrl).toContain("/admin/directory/v1/groups");
    expect(firstUrl).toContain("userKey=u%40x.com");
  });

  it("throws when Groups API returns non-404 error", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 500,
      body: "err",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.listUserGroups("t", "u@x.com")).rejects.toThrow(
      /Google Workspace Groups API failed \(500\): err/,
    );
  });

  it("returns DISCONNECTED when connection is missing", async () => {
    mockFindUnique.mockResolvedValue(null);

    const h = await adapter.getHealthStatus("missing");

    expect(h.status).toBe("DISCONNECTED");
    expect(h.provider).toBe("google_workspace");
  });

  it("returns DISCONNECTED when connection status is not CONNECTED", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "GOOGLE_WORKSPACE",
      displayName: "GW",
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: null,
      status: "PENDING_MAPPING",
    });

    const h = await adapter.getHealthStatus("c1");

    expect(h.status).toBe("DISCONNECTED");
  });

  it("returns ERROR when connected but only lastError and no success", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "GOOGLE_WORKSPACE",
      displayName: "GW",
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: new Date(),
      lastErrorMessage: "x",
      tokenExpiresAt: null,
      status: "CONNECTED",
    });

    const h = await adapter.getHealthStatus("c1");

    expect(h.status).toBe("ERROR");
  });

  it("returns REAUTH_REQUIRED when token is expired", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "GOOGLE_WORKSPACE",
      displayName: "GW",
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: new Date(Date.now() - 60_000),
      status: "CONNECTED",
    });

    const h = await adapter.getHealthStatus("c1");

    expect(h.status).toBe("REAUTH_REQUIRED");
  });

  it("returns ERROR when latest sync log is FAILED", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "GOOGLE_WORKSPACE",
      displayName: "GW",
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      status: "CONNECTED",
    });
    mockFindMany.mockResolvedValue([
      {
        id: "log-1",
        syncType: "DIRECTORY",
        status: "FAILED",
        startedAt: new Date(),
        completedAt: null,
      },
    ]);

    const h = await adapter.getHealthStatus("c1");

    expect(h.status).toBe("ERROR");
  });

  it("returns CONNECTED when healthy", async () => {
    mockFindUnique.mockResolvedValue({
      provider: "GOOGLE_WORKSPACE",
      displayName: "GW",
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      status: "CONNECTED",
    });
    mockFindMany.mockResolvedValue([
      {
        id: "log-1",
        syncType: "DIRECTORY",
        status: "SUCCESS",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const h = await adapter.getHealthStatus("c1");

    expect(h.status).toBe("CONNECTED");
    expect(h.displayName).toBe("GW");
  });
});
