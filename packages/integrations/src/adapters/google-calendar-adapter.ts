import { createHash } from 'node:crypto';
import { z } from 'zod';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Timeout budgets
// ---------------------------------------------------------------------------
//
// OAuth token redemption + refresh — non-idempotent POST. 30s wall-clock,
// no retries (replaying can claim multiple sessions or invalidate refresh
// tokens). Matches Slack/DocuSign precedent.
const OAUTH_TIMEOUT_MS = 30_000;
// Calendar event mutations — POST/PATCH/DELETE. The caller now passes a
// deterministic idempotency key on createEvent (used as the
// event `id` so a duplicate insert returns 409 instead of inserting twice).
// `updateEvent` and `deleteEvent` operate on a stable eventId so a retry
// of the same call is naturally idempotent. Both are safe to retry.
// 15s wall-clock; the helper aborts on transport hangs.
const MUTATION_TIMEOUT_MS = 15_000;
const MUTATION_RETRIES = 2;
// Read-only GET / freebusy POST (idempotent query). 15s + 2 retries.
const READ_TIMEOUT_MS = 15_000;
const READ_RETRIES = 2;

// ---------------------------------------------------------------------------
// Idempotency key encoding
// ---------------------------------------------------------------------------
//
// Google Calendar's `events.insert` accepts an optional `id` field on the
// request body. When supplied, a duplicate insert with the same id returns
// 409 Conflict instead of creating a second event — the production-grade
// idempotency mechanism documented at
// https://developers.google.com/calendar/api/v3/reference/events#id.
//
// Constraints from the API:
//   - characters: lowercase letters a–v and digits 0–9 (RFC 2938 base32hex)
//   - length: 5–1024
//
// `encodeGoogleEventId` derives a stable id from the caller's idempotency
// key by sha-256 hashing it and rendering the digest as base32hex. The
// 64-character output is well within the size budget and gives 256 bits of
// collision resistance.
const BASE32HEX_ALPHABET = '0123456789abcdefghijklmnopqrstuv';

function encodeGoogleEventId(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey).digest();
  let out = '';
  // Walk 5-bit nibbles across the 32-byte digest. Yields 51 chars; pad with
  // trailing '0' for 5 chars to satisfy Google's 5-char minimum (digest is
  // 256 bits so we always have plenty of entropy regardless of padding).
  let buffer = 0;
  let bits = 0;
  for (const byte of digest) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32HEX_ALPHABET[(buffer >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32HEX_ALPHABET[(buffer << (5 - bits)) & 0x1f];
  }
  return out;
}

/**
 * Busy range returned by getFreeBusy.
 * Used by the pto-detector service to apply the layered detection rule
 * (manual outOfOffice → calendar all-day busy → PTO_KEYWORDS title match).
 */
export interface GoogleBusyRange {
  start: string;
  end: string;
  summary?: string;
  isAllDay?: boolean;
  attendeeCount?: number;
}

// ---------------------------------------------------------------------------
// Google Calendar OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Google Calendar uses OAuth 2.0 Authorization Code Grant.
 *
 * Scopes:
 * - calendar.events — full CRUD on events (not calendar metadata)
 *
 * Env vars required:
 * - GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET — for OAuth
 * - GOOGLE_CALENDAR_ENCRYPTION_KEY — for credential encryption at rest
 */
const GOOGLE_CALENDAR_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: 'GOOGLE_CALENDAR_CLIENT_ID',
  clientSecretEnvVar: 'GOOGLE_CALENDAR_CLIENT_SECRET',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
  redirectPath: '/api/oauth/google-calendar/callback',
  extraAuthParams: {
    access_type: 'offline',
    prompt: 'consent',
  },
};

/**
 * Google OAuth 2.0 token response (authorization_code + refresh_token grants).
 * Validated at the credential-persist boundary so a malformed/changed payload
 * fails closed instead of persisting a corrupt CredentialBlob. Google omits
 * refresh_token on the refresh grant (and on re-consent without
 * access_type=offline), so it is optional. expires_in must be a finite
 * non-negative number so the derived expiresAt is a valid ISO timestamp.
 */
const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().finite().nonnegative(),
  token_type: z.string().min(1),
  scope: z.string(),
});

// ---------------------------------------------------------------------------
// Google Calendar Adapter
// ---------------------------------------------------------------------------

export class GoogleCalendarAdapter extends BaseAdapter {
  readonly slug = 'google-calendar';
  readonly displayName = 'Google Calendar';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return GOOGLE_CALENDAR_OAUTH_CONFIG;
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables are required',
      );
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://oauth2.googleapis.com/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri,
            }),
          },
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      // Authorization-code redemption is non-idempotent.
      { provider: 'google-calendar', retryAttempts: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar OAuth exchange failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      googleTokenResponseSchema,
      'google-calendar:exchangeCodeForTokens',
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables are required',
      );
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Google Calendar');
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://oauth2.googleapis.com/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'refresh_token',
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: credentials.refreshToken,
            }),
          },
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'google-calendar' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar token refresh failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      googleTokenResponseSchema,
      'google-calendar:refreshToken',
    );

    return {
      accessToken: data.access_token,
      refreshToken: credentials.refreshToken, // Google doesn't rotate refresh tokens
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Calendar Event CRUD
  // -------------------------------------------------------------------------

  /**
   * Creates a calendar event on the user's primary calendar.
   *
   * Idempotency: when the caller supplies `idempotencyKey`, it is encoded as
   * the event `id` (RFC 2938 base32hex sha-256 digest). A retry of the same
   * logical create then returns 409 Conflict from Google instead of inserting
   * a duplicate — which is what makes `retryNonIdempotent: true` safe at the
   * transport layer below. Callers derive the key as e.g.
   * `sha256(`${orgId}:${calendarId}:${entityId}:create`)`.
   *
   * @param accessToken - The OAuth access token
   * @param event - Event details
   * @param idempotencyKey - Optional deterministic dedup key; encoded as
   *   the Google event `id` so duplicate inserts are rejected by the API.
   * @returns Created event ID, HTML link, and etag for concurrency control
   */
  async createEvent(
    accessToken: string,
    event: {
      summary: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      attendees?: string[];
    },
    idempotencyKey?: string,
  ): Promise<{ eventId: string; htmlLink: string; etag: string }> {
    const body: Record<string, unknown> = {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.startDateTime, timeZone: 'UTC' },
      end: { dateTime: event.endDateTime, timeZone: 'UTC' },
      reminders: { useDefault: true },
    };

    if (event.attendees?.length) {
      body.attendees = event.attendees.map(email => ({ email }));
    }

    if (idempotencyKey) {
      body.id = encodeGoogleEventId(idempotencyKey);
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
          { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
        ),
      // Without an idempotency key, a transport-level retry could double-insert
      // the event — keep retries at 0. With a key, Google dedups by event id
      // and the outer resilience loop is safe to retry.
      {
        provider: 'google-calendar',
        retryAttempts: idempotencyKey ? MUTATION_RETRIES : 0,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar create event failed: ${text}`);
    }

    const data = (await response.json()) as {
      id: string;
      htmlLink: string;
      etag: string;
    };

    return {
      eventId: data.id,
      htmlLink: data.htmlLink,
      etag: data.etag,
    };
  }

  /**
   * Updates an existing calendar event.
   *
   * Uses `If-Match` header with etag for optimistic concurrency control.
   *
   * @param accessToken - The OAuth access token
   * @param eventId - The event ID to update
   * @param event - Updated event details
   * @param etag - The etag from the last read for concurrency control
   * @returns Updated event ID, HTML link, and new etag
   */
  async updateEvent(
    accessToken: string,
    eventId: string,
    event: {
      summary?: string;
      description?: string;
      startDateTime?: string;
      endDateTime?: string;
      attendees?: string[];
    },
    etag: string,
  ): Promise<{ eventId: string; htmlLink: string; etag: string }> {
    const body: Record<string, unknown> = {};

    if (event.summary !== undefined) body.summary = event.summary;
    if (event.description !== undefined) body.description = event.description;
    if (event.startDateTime) {
      body.start = { dateTime: event.startDateTime, timeZone: 'UTC' };
    }
    if (event.endDateTime) {
      body.end = { dateTime: event.endDateTime, timeZone: 'UTC' };
    }
    if (event.attendees?.length) {
      body.attendees = event.attendees.map(email => ({ email }));
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'If-Match': etag,
            },
            body: JSON.stringify(body),
          },
          { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
        ),
      // PATCH on a stable eventId with `If-Match: etag` is idempotent — the
      // etag check on the server prevents lost updates if a retry races with
      // a concurrent edit (we surface 412 Precondition Failed instead).
      { provider: 'google-calendar', retryAttempts: MUTATION_RETRIES },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar update event failed: ${text}`);
    }

    const data = (await response.json()) as {
      id: string;
      htmlLink: string;
      etag: string;
    };

    return {
      eventId: data.id,
      htmlLink: data.htmlLink,
      etag: data.etag,
    };
  }

  /**
   * Deletes a calendar event.
   *
   * DELETE on a stable eventId is naturally idempotent — Google returns
   * 404/410 on the second call and the caller treats both 2xx and 410 as
   * success. Safe to retry on transport errors.
   *
   * @param accessToken - The OAuth access token
   * @param eventId - The event ID to delete
   */
  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const response = await withResilience(
      () =>
        fetchWithTimeout(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
          { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'google-calendar', retryAttempts: MUTATION_RETRIES },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar delete event failed: ${text}`);
    }
  }

  /**
   * Fetch free-busy ranges enriched with event titles and all-day flags so
   * the PTO detector can match against PTO_KEYWORDS.
   *
   * Performs two API calls and merges the results:
   *   1. POST /calendar/v3/freeBusy — authoritative busy ranges
   *   2. GET /calendar/v3/calendars/{id}/events — titles + isAllDay flags +
   *      attendee counts for the same window.
   *
   * Access token is never included in error messages — only the response
   * body is surfaced so token leakage is prevented.
   */
  async getFreeBusy(
    accessToken: string,
    args: { calendarId?: string; timeMin: string; timeMax: string },
  ): Promise<{ busy: GoogleBusyRange[] }> {
    const calendarId = args.calendarId ?? 'primary';
    // freeBusy is a read-only POST — safe to retry under withResilience.
    const fbResp = await withResilience(
      () =>
        fetchWithTimeout(
          'https://www.googleapis.com/calendar/v3/freeBusy',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timeMin: args.timeMin,
              timeMax: args.timeMax,
              items: [{ id: calendarId }],
            }),
          },
          { timeoutMs: READ_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'google-calendar', retryAttempts: READ_RETRIES },
    );
    if (!fbResp.ok) {
      const text = await fbResp.text();
      throw new Error(`Google Calendar freebusy failed (${fbResp.status}): ${text}`);
    }
    const fbData = (await fbResp.json()) as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    };
    const busyRanges = fbData.calendars?.[calendarId]?.busy ?? [];

    // Enrichment — events.list for titles + isAllDay
    const eventsUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    eventsUrl.searchParams.set('timeMin', args.timeMin);
    eventsUrl.searchParams.set('timeMax', args.timeMax);
    eventsUrl.searchParams.set('singleEvents', 'true');
    const evResp = await withResilience(
      () =>
        fetchWithTimeout(
          eventsUrl.toString(),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
          { timeoutMs: READ_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'google-calendar', retryAttempts: READ_RETRIES },
    );
    if (!evResp.ok) {
      // Enrichment failure is non-fatal — return ranges without titles.
      return { busy: busyRanges.map(b => ({ ...b })) };
    }
    const evData = (await evResp.json()) as {
      items?: Array<{
        summary?: string;
        start: { date?: string; dateTime?: string };
        end: { date?: string; dateTime?: string };
        attendees?: unknown[];
      }>;
    };
    const events = evData.items ?? [];

    return {
      busy: busyRanges.map(range => {
        // Match by date prefix to handle both timed events (dateTime equals range.start)
        // and all-day events (date is YYYY-MM-DD but range.start is YYYY-MM-DDT00:00:00Z).
        const rangeDatePrefix = range.start.slice(0, 10);
        const matched = events.find(e => {
          if (e.start.dateTime) {
            return e.start.dateTime === range.start;
          }
          return e.start.date === rangeDatePrefix;
        });
        return {
          start: range.start,
          end: range.end,
          summary: matched?.summary,
          isAllDay: Boolean(matched?.start.date && !matched.start.dateTime),
          attendeeCount: matched?.attendees?.length ?? 0,
        };
      }),
    };
  }

  // -------------------------------------------------------------------------
  // Health Status — uses BaseAdapter default (no custom behavior).
  // -------------------------------------------------------------------------
}
