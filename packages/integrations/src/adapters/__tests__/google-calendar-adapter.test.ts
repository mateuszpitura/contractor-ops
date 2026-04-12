import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarAdapter } from "../google-calendar-adapter.js";

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

describe("GoogleCalendarAdapter", () => {
  let adapter: GoogleCalendarAdapter;

  beforeEach(() => {
    adapter = new GoogleCalendarAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  });

  it("returns OAuthConfig with Google authorization URL and calendar.events scope", () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(c.tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(c.scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(c.extraAuthParams?.access_type).toBe("offline");
  });

  it("throws when OAuth env vars are missing for exchangeCodeForTokens", async () => {
    await expect(adapter.exchangeCodeForTokens("code", "http://localhost/cb")).rejects.toThrow(
      /GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables are required/,
    );
  });

  it("exchanges code for tokens using JSON body", async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "cid";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/calendar.events",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.exchangeCodeForTokens("code", "http://localhost/cb");

    expect(out.accessToken).toBe("at");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.grant_type).toBe("authorization_code");
    expect(body.client_id).toBe("cid");
  });

  it("throws when OAuth code exchange returns non-OK", async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "cid";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: false,
      status: 400,
      body: "invalid_grant",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.exchangeCodeForTokens("bad", "http://localhost/cb")).rejects.toThrow(
      /Google Calendar OAuth exchange failed: invalid_grant/,
    );
  });

  it("refreshes token using refresh_token grant", async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "cid";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: "at2",
        expires_in: 7200,
        token_type: "Bearer",
        scope: "cal",
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.refreshToken({
      accessToken: "old",
      refreshToken: "rt",
      tokenType: "Bearer",
      scope: "cal",
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
        tokenType: "Bearer",
        scope: "cal",
      }),
    ).rejects.toThrow(
      /GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables are required/,
    );
  });

  it("throws when refreshToken has no refresh_token in blob", async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "cid";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "csec";

    await expect(
      adapter.refreshToken({
        accessToken: "old",
        refreshToken: undefined,
        tokenType: "Bearer",
        scope: "cal",
      }),
    ).rejects.toThrow(/No refresh token available for Google Calendar/);
  });

  it("throws when token refresh returns non-OK", async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "cid";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "csec";

    const fetchMock = mockFetch({
      ok: false,
      status: 400,
      body: "invalid_grant",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      adapter.refreshToken({
        accessToken: "old",
        refreshToken: "rt",
        tokenType: "Bearer",
        scope: "cal",
      }),
    ).rejects.toThrow(/Google Calendar token refresh failed: invalid_grant/);
  });

  it("createEvent returns eventId, htmlLink, and etag", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        id: "evt-1",
        htmlLink: "https://calendar.google.com/e/evt-1",
        etag: '"abc123"',
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.createEvent("tok", {
      summary: "Stand-up",
      startDateTime: "2026-04-04T09:00:00.000Z",
      endDateTime: "2026-04-04T09:30:00.000Z",
    });

    expect(out).toEqual({
      eventId: "evt-1",
      htmlLink: "https://calendar.google.com/e/evt-1",
      etag: '"abc123"',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
  });

  it("createEvent sends attendees in request body when provided", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { id: "e2", htmlLink: "https://x", etag: "e" },
    });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.createEvent("tok", {
      summary: "Review",
      startDateTime: "2026-04-04T10:00:00.000Z",
      endDateTime: "2026-04-04T11:00:00.000Z",
      attendees: ["a@example.com", "b@example.com"],
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const parsed = JSON.parse((init as RequestInit).body as string);
    expect(parsed.attendees).toEqual([{ email: "a@example.com" }, { email: "b@example.com" }]);
  });

  it("throws when createEvent returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 403,
      body: "quotaExceeded",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      adapter.createEvent("tok", {
        summary: "X",
        startDateTime: "2026-04-04T09:00:00.000Z",
        endDateTime: "2026-04-04T09:30:00.000Z",
      }),
    ).rejects.toThrow(/Google Calendar create event failed: quotaExceeded/);
  });

  it("returns undefined event fields when API returns empty JSON object (malformed success)", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {},
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await adapter.createEvent("tok", {
      summary: "X",
      startDateTime: "2026-04-04T09:00:00.000Z",
      endDateTime: "2026-04-04T09:30:00.000Z",
    });

    expect(out).toEqual({
      eventId: undefined,
      htmlLink: undefined,
      etag: undefined,
    });
  });

  it("updateEvent sends If-Match header with etag", async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        id: "evt-1",
        htmlLink: "https://calendar.google.com/e/evt-1",
        etag: '"newetag"',
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.updateEvent("tok", "evt-1", { summary: "Updated" }, '"oldetag"');

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).headers).toMatchObject({
      "If-Match": '"oldetag"',
    });
  });

  it("throws when updateEvent returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 412,
      body: "Precondition Failed",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.updateEvent("tok", "evt-1", { summary: "X" }, '"etag"')).rejects.toThrow(
      /Google Calendar update event failed: Precondition Failed/,
    );
  });

  it("deleteEvent sends DELETE to event endpoint", async () => {
    const fetchMock = mockFetch({ ok: true, body: {} });
    vi.stubGlobal("fetch", fetchMock);

    await adapter.deleteEvent("tok", "evt-del");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events/evt-del");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws when deleteEvent returns non-OK", async () => {
    const fetchMock = mockFetch({
      ok: false,
      status: 404,
      body: "Not Found",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(adapter.deleteEvent("tok", "missing")).rejects.toThrow(
      /Google Calendar delete event failed: Not Found/,
    );
  });
});
