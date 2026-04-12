import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutlookCalendarAdapter } from "../outlook-calendar-adapter.js";

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

describe("OutlookCalendarAdapter", () => {
  let adapter: OutlookCalendarAdapter;

  beforeEach(() => {
    adapter = new OutlookCalendarAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OUTLOOK_CLIENT_ID;
    delete process.env.OUTLOOK_CLIENT_SECRET;
  });

  it("returns OAuthConfig with Microsoft common tenant authorize URL", () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toContain("login.microsoftonline.com/common");
    expect(c.tokenUrl).toContain("oauth2/v2.0/token");
    expect(c.scopes).toContain("Calendars.ReadWrite");
    expect(c.scopes).toContain("offline_access");
  });

  it("throws when OAuth env vars are missing for exchangeCodeForTokens", async () => {
    await expect(adapter.exchangeCodeForTokens("code", "http://localhost/cb")).rejects.toThrow(
      /OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET environment variables are required/,
    );
  });

  it("exchanges code for tokens using application/x-www-form-urlencoded", async () => {
    process.env.OUTLOOK_CLIENT_ID = "oid";
    process.env.OUTLOOK_CLIENT_SECRET = "osec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "Calendars.ReadWrite offline_access",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.exchangeCodeForTokens("code", "http://localhost/cb");

    expect(out.accessToken).toBe("at");
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("throws when OAuth code exchange returns non-OK", async () => {
    process.env.OUTLOOK_CLIENT_ID = "oid";
    process.env.OUTLOOK_CLIENT_SECRET = "osec";

    const fetchMock = mockFetch({
      ok: false,
      status: 400,
      body: "invalid_grant",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.exchangeCodeForTokens("bad", "http://localhost/cb")).rejects.toThrow(
      /Outlook Calendar OAuth exchange failed: invalid_grant/,
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
      /OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET environment variables are required/,
    );
  });

  it("throws when refreshToken has no refresh_token in blob", async () => {
    process.env.OUTLOOK_CLIENT_ID = "oid";
    process.env.OUTLOOK_CLIENT_SECRET = "osec";

    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: undefined,
        tokenType: "Bearer",
        scope: "x",
      }),
    ).rejects.toThrow(/No refresh token available for Outlook Calendar/);
  });

  it("refreshes token using refresh_token grant", async () => {
    process.env.OUTLOOK_CLIENT_ID = "oid";
    process.env.OUTLOOK_CLIENT_SECRET = "osec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "at2",
        expires_in: 7200,
        token_type: "Bearer",
        scope: "Calendars.ReadWrite offline_access",
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
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
  });

  it("throws when token refresh returns non-OK", async () => {
    process.env.OUTLOOK_CLIENT_ID = "oid";
    process.env.OUTLOOK_CLIENT_SECRET = "osec";

    const fetchMock = mockFetch({
      ok: false,
      status: 401,
      body: "invalid_client",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      adapter.refreshToken({
        accessToken: "a",
        refreshToken: "rt",
        tokenType: "Bearer",
        scope: "x",
      }),
    ).rejects.toThrow(/Outlook Calendar token refresh failed: invalid_client/);
  });

  it("throws when createEvent returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 403,
      body: "AccessDenied",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      adapter.createEvent("tok", {
        subject: "X",
        startDateTime: "2026-04-04T10:00:00.000Z",
        endDateTime: "2026-04-04T11:00:00.000Z",
      }),
    ).rejects.toThrow(/Outlook Calendar create event failed: AccessDenied/);
  });

  it("createEvent sends attendees and HTML body when provided", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { id: "e-att", webLink: "https://outlook.office365.com/x" },
    });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.createEvent("tok", {
      subject: "Sync",
      bodyHtml: "<p>Hello</p>",
      startDateTime: "2026-04-04T10:00:00.000Z",
      endDateTime: "2026-04-04T11:00:00.000Z",
      attendees: ["x@example.com"],
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.body).toEqual({
      contentType: "HTML",
      content: "<p>Hello</p>",
    });
    expect(body.attendees).toEqual([
      { emailAddress: { address: "x@example.com" }, type: "required" },
    ]);
  });

  it("createEvent uses dateTime + timeZone objects on start/end (Graph shape)", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { id: "evt-ms", webLink: "https://outlook.office365.com/calendar/evt-ms" },
    });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.createEvent("tok", {
      subject: "Meeting",
      startDateTime: "2026-04-04T10:00:00.000Z",
      endDateTime: "2026-04-04T11:00:00.000Z",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.start).toEqual({
      dateTime: "2026-04-04T10:00:00.000Z",
      timeZone: "UTC",
    });
    expect(body.end).toEqual({
      dateTime: "2026-04-04T11:00:00.000Z",
      timeZone: "UTC",
    });
  });

  it("createEvent returns eventId and webLink", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { id: "e1", webLink: "https://outlook.office365.com/x" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.createEvent("tok", {
      subject: "S",
      startDateTime: "2026-04-04T10:00:00.000Z",
      endDateTime: "2026-04-04T11:00:00.000Z",
    });

    expect(out.eventId).toBe("e1");
    expect(out.webLink).toContain("outlook");
  });

  it("returns undefined eventId and webLink when Graph returns empty success body", async () => {
    const fetchMock = mockFetch({ ok: true, body: {} });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.createEvent("tok", {
      subject: "S",
      startDateTime: "2026-04-04T10:00:00.000Z",
      endDateTime: "2026-04-04T11:00:00.000Z",
    });

    expect(out).toEqual({ eventId: undefined, webLink: undefined });
  });

  it("updateEvent sends PATCH to Graph event URL", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { id: "evt-upd", webLink: "https://outlook.office365.com/y" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.updateEvent("tok", "evt-upd", { subject: "New title" });

    expect(out.eventId).toBe("evt-upd");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/calendar/events/evt-upd");
    expect((init as RequestInit).method).toBe("PATCH");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.subject).toBe("New title");
  });

  it("throws when updateEvent returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 400,
      body: "BadRequest",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.updateEvent("tok", "bad-id", { subject: "X" })).rejects.toThrow(
      /Outlook Calendar update event failed: BadRequest/,
    );
  });

  it("deleteEvent sends DELETE to MS Graph event endpoint", async () => {
    const fetchMock = mockFetch({ ok: true, body: {} });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.deleteEvent("tok", "evt-to-delete");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/calendar/events/evt-to-delete");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws when deleteEvent returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 404,
      body: "itemNotFound",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.deleteEvent("tok", "gone")).rejects.toThrow(
      /Outlook Calendar delete event failed: itemNotFound/,
    );
  });
});
