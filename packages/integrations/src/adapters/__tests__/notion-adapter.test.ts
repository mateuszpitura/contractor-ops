import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotionAdapter } from "../notion-adapter.js";

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

describe("NotionAdapter", () => {
  let adapter: NotionAdapter;

  beforeEach(() => {
    adapter = new NotionAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.NOTION_CLIENT_ID;
    delete process.env.NOTION_CLIENT_SECRET;
  });

  it("returns OAuthConfig with Notion authorization URL and empty scopes", () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toBe("https://api.notion.com/v1/oauth/authorize");
    expect(c.tokenUrl).toBe("https://api.notion.com/v1/oauth/token");
    expect(c.scopes).toEqual([]);
  });

  it("throws when exchangeCodeForTokens is called without Notion client env vars", async () => {
    await expect(adapter.exchangeCodeForTokens("code", "http://localhost/cb")).rejects.toThrow(
      /NOTION_CLIENT_ID and NOTION_CLIENT_SECRET/,
    );
  });

  it("exchanges code using HTTP Basic auth (not client_secret in body)", async () => {
    process.env.NOTION_CLIENT_ID = "nid";
    process.env.NOTION_CLIENT_SECRET = "nsec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "secret_token",
        token_type: "bearer",
        bot_id: "b1",
        workspace_id: "ws",
        workspace_name: "WS",
        workspace_icon: null,
        duplicated_template_id: null,
        owner: {},
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.exchangeCodeForTokens("code", "http://localhost/cb");

    expect(out.accessToken).toBe("secret_token");
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("nid:nsec").toString("base64")}`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).not.toHaveProperty("client_secret");
    expect(body.grant_type).toBe("authorization_code");
  });

  it("refreshes token using refresh_token grant and Basic auth", async () => {
    process.env.NOTION_CLIENT_ID = "nid";
    process.env.NOTION_CLIENT_SECRET = "nsec";

    const fetchMock = mockFetch({
      ok: true,
      body: { access_token: "new", token_type: "bearer" },
    });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.refreshToken({
      accessToken: "old",
      refreshToken: "rt",
      tokenType: "bearer",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("rt");
  });

  it("throws when refreshToken is called without env credentials", async () => {
    await expect(
      adapter.refreshToken({
        accessToken: "old",
        refreshToken: "rt",
        tokenType: "bearer",
      }),
    ).rejects.toThrow(
      /NOTION_CLIENT_ID and NOTION_CLIENT_SECRET environment variables are required/,
    );
  });

  it("throws when refreshToken has no refresh_token in blob", async () => {
    process.env.NOTION_CLIENT_ID = "nid";
    process.env.NOTION_CLIENT_SECRET = "nsec";

    await expect(
      adapter.refreshToken({
        accessToken: "old",
        refreshToken: undefined,
        tokenType: "bearer",
      }),
    ).rejects.toThrow(/No refresh token available for Notion/);
  });

  it("throws when OAuth exchange returns non-OK", async () => {
    process.env.NOTION_CLIENT_ID = "nid";
    process.env.NOTION_CLIENT_SECRET = "nsec";

    const fetchMock = mockFetch({
      ok: false,
      status: 400,
      body: "bad_code",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.exchangeCodeForTokens("bad", "http://localhost/cb")).rejects.toThrow(
      /Notion OAuth exchange failed: bad_code/,
    );
  });

  it("throws when token refresh returns non-OK", async () => {
    process.env.NOTION_CLIENT_ID = "nid";
    process.env.NOTION_CLIENT_SECRET = "nsec";

    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      body: "revoked",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      adapter.refreshToken({
        accessToken: "old",
        refreshToken: "rt",
        tokenType: "bearer",
      }),
    ).rejects.toThrow(/Notion token refresh failed: revoked/);
  });

  it("searchPages sends Notion-Version 2022-06-28 and page filter", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        results: [
          {
            object: "page",
            id: "page-uuid-here",
            last_edited_time: "2026-04-01T00:00:00.000Z",
            icon: { type: "emoji", emoji: "📄" },
            properties: {
              title: { title: [{ plain_text: "My Page" }] },
            },
          },
        ],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await adapter.searchPages("tok", "invoice");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.notion.com/v1/search");
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Notion-Version"]).toBe("2022-06-28");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.filter).toEqual({ property: "object", value: "page" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "page-uuid-here",
      title: "My Page",
      icon: "📄",
      lastEditedTime: "2026-04-01T00:00:00.000Z",
    });
    expect(rows[0]?.url).toContain("notion.so");
  });

  it("maps non-emoji icon to external url when present", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        results: [
          {
            object: "page",
            id: "p2",
            last_edited_time: "2026-04-01T00:00:00.000Z",
            icon: { type: "external", external: { url: "https://cdn/x.png" } },
            properties: { title: { title: [{ plain_text: "T" }] } },
          },
        ],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await adapter.searchPages("tok", "q");
    expect(rows[0]?.icon).toBe("https://cdn/x.png");
  });

  it("searchPages uses Untitled when page has no title property", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        results: [
          {
            object: "page",
            id: "p-no-title",
            last_edited_time: "2026-04-01T00:00:00.000Z",
            properties: {},
          },
        ],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await adapter.searchPages("tok", "q");
    expect(rows[0]?.title).toBe("Untitled");
  });

  it("throws when search returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 429,
      body: "rate_limited",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.searchPages("tok", "anything")).rejects.toThrow(
      /Notion search failed: rate_limited/,
    );
  });
});
