import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfluenceAdapter } from "../confluence-adapter.js";

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

describe("ConfluenceAdapter", () => {
  let adapter: ConfluenceAdapter;

  beforeEach(() => {
    adapter = new ConfluenceAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.CONFLUENCE_CLIENT_ID;
    delete process.env.CONFLUENCE_CLIENT_SECRET;
  });

  it("returns OAuthConfig with Atlassian authorize URL and search scopes", () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toBe("https://auth.atlassian.com/authorize");
    expect(c.tokenUrl).toBe("https://auth.atlassian.com/oauth/token");
    expect(c.scopes).toContain("search:confluence");
  });

  it("throws when exchangeCodeForTokens is called without client env vars", async () => {
    await expect(adapter.exchangeCodeForTokens("code", "http://localhost/cb")).rejects.toThrow(
      /CONFLUENCE_CLIENT_ID and CONFLUENCE_CLIENT_SECRET/,
    );
  });

  it("exchanges code for tokens using JSON body with client credentials", async () => {
    process.env.CONFLUENCE_CLIENT_ID = "cid";
    process.env.CONFLUENCE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "read:confluence-content.summary",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.exchangeCodeForTokens("code", "http://localhost/cb");

    expect(out.accessToken).toBe("at");
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.grant_type).toBe("authorization_code");
    expect(body.client_id).toBe("cid");
    expect(body.client_secret).toBe("csec");
  });

  it("throws when OAuth code exchange returns non-OK", async () => {
    process.env.CONFLUENCE_CLIENT_ID = "cid";
    process.env.CONFLUENCE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: false,
      status: 400,
      body: "invalid_client",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.exchangeCodeForTokens("bad", "http://localhost/cb")).rejects.toThrow(
      /Confluence OAuth exchange failed: invalid_client/,
    );
  });

  it("throws when refreshToken is called without env credentials", async () => {
    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: "rt",
        tokenType: "Bearer",
        scope: "x",
      }),
    ).rejects.toThrow(
      /CONFLUENCE_CLIENT_ID and CONFLUENCE_CLIENT_SECRET environment variables are required/,
    );
  });

  it("refreshes token using refresh_token grant", async () => {
    process.env.CONFLUENCE_CLIENT_ID = "cid";
    process.env.CONFLUENCE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "at2",
        refresh_token: "rt2",
        expires_in: 7200,
        token_type: "Bearer",
        scope: "x",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.refreshToken({
      accessToken: "a",
      refreshToken: "rt",
      tokenType: "Bearer",
      scope: "x",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.grant_type).toBe("refresh_token");
  });

  it("throws when token refresh returns non-OK", async () => {
    process.env.CONFLUENCE_CLIENT_ID = "cid";
    process.env.CONFLUENCE_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      body: "invalid_grant",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: "rt",
        tokenType: "Bearer",
        scope: "x",
      }),
    ).rejects.toThrow(/Confluence token refresh failed: invalid_grant/);
  });

  it("throws when refreshToken is called without a refresh token", async () => {
    process.env.CONFLUENCE_CLIENT_ID = "cid";
    process.env.CONFLUENCE_CLIENT_SECRET = "csec";

    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: "",
        tokenType: "Bearer",
        scope: "x",
      }),
    ).rejects.toThrow(/No refresh token available for Confluence/);
  });

  it("throws when refreshToken blob has undefined refreshToken", async () => {
    process.env.CONFLUENCE_CLIENT_ID = "cid";
    process.env.CONFLUENCE_CLIENT_SECRET = "csec";

    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: undefined,
        tokenType: "Bearer",
        scope: "x",
      }),
    ).rejects.toThrow(/No refresh token available for Confluence/);
  });

  it("discoverCloudId returns cloudId and siteName from accessible-resources", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: [
        {
          id: "cloud-uuid",
          name: "My Site",
          url: "https://mysite.atlassian.net",
          scopes: [],
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.discoverCloudId("tok");

    expect(out).toEqual({
      cloudId: "cloud-uuid",
      siteName: "My Site",
      siteUrl: "https://mysite.atlassian.net",
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://api.atlassian.com/oauth/token/accessible-resources",
    );
  });

  it("throws when discoverCloudId gets non-OK from accessible-resources", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      body: "Unauthorized",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.discoverCloudId("bad-tok")).rejects.toThrow(
      /Confluence accessible-resources discovery failed: Unauthorized/,
    );
  });

  it("throws when discoverCloudId returns empty resource list", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.discoverCloudId("tok")).rejects.toThrow(
      /No accessible Confluence Cloud sites found/,
    );
  });

  it("searchPages uses CQL title search in URL", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        results: [
          {
            content: {
              id: "123",
              title: "Runbook",
              _links: { webui: "/spaces/ENG/pages/123" },
            },
            resultGlobalContainer: {
              title: "Engineering",
              displayUrl: "/wiki/spaces/ENG",
            },
          },
        ],
        _links: { base: "https://mysite.atlassian.net/wiki" },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await adapter.searchPages("tok", "cloud-uuid", "Runbook");

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/ex/confluence/cloud-uuid/");
    expect(url).toContain(encodeURIComponent('type=page AND title~"Runbook"'));

    expect(rows[0]).toMatchObject({
      id: "123",
      title: "Runbook",
      spaceName: "Engineering",
    });
    expect(rows[0]?.url).toContain("/wiki");
  });

  it("throws when searchPages returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 403,
      body: "Forbidden",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.searchPages("tok", "cloud-uuid", "q")).rejects.toThrow(
      /Confluence search failed: Forbidden/,
    );
  });
});
