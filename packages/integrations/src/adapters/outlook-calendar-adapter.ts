import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse, safeParseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * Microsoft identity-platform OAuth 2.0 token response (exchange + refresh share
 * the same shape). Validated at the credential-persist boundary (fail closed).
 */
const outlookTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().nonnegative(),
  token_type: z.string().min(1),
  scope: z.string(),
});

/**
 * Microsoft Graph `getSchedule` response — only the fields getFreeBusy reads.
 * Validated as a transient read so a drifted body degrades to an empty busy
 * list rather than coercing junk.
 */
const graphScheduleSchema = z.object({
  value: z
    .array(
      z.object({
        scheduleItems: z
          .array(
            z.object({
              status: z.string(),
              subject: z.string().optional(),
              start: z.object({ dateTime: z.string() }),
              end: z.object({ dateTime: z.string() }),
              isAllDay: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Timeout budgets (F-INT-01 / F-INT-02)
// ---------------------------------------------------------------------------
//
// OAuth token redemption + refresh — non-idempotent POST against Microsoft
// Identity Platform. 30s wall-clock, no retries (replaying can claim
// multiple sessions or invalidate the refresh token).
const OAUTH_TIMEOUT_MS = 30_000;
// Calendar event mutations — POST/PATCH/DELETE against Graph. With F-INT-04
// the caller now passes a deterministic idempotency key on createEvent,
// surfaced via the `client-request-id` Graph header so duplicate inserts
// can be reconciled / observed in Microsoft's telemetry. `updateEvent` and
// `deleteEvent` operate on a stable eventId so transport retries are
// naturally safe. 15s wall-clock; helper aborts on transport hangs.
const MUTATION_TIMEOUT_MS = 15_000;
const MUTATION_RETRIES = 2;
// getSchedule POST is read-only — opt in to retry on 429/5xx.
const READ_TIMEOUT_MS = 15_000;
const READ_RETRIES = 2;

// ---------------------------------------------------------------------------
// Idempotency key encoding (F-INT-04)
// ---------------------------------------------------------------------------
//
// Microsoft Graph documents the `client-request-id` header as the standard
// per-request correlation/dedup id. It must be a UUID (per Graph error
// guidance), so we derive a deterministic v4-shaped UUID from the caller's
// idempotency key by sha-256 hashing it and applying the RFC 4122 v5-style
// variant/version bits. Same input → same UUID → same correlation id.
//
// Graph's behaviour on duplicate `client-request-id` is "last write wins"
// rather than 409 Conflict (unlike Google). The header still serves two
// purposes: (a) it surfaces the dedup intent in Graph telemetry so on-call
// can spot duplicate writes, and (b) it lets us safely opt the transport
// layer into `retryNonIdempotent: true` because any duplicate POST will be
// tagged with the same id and reconcilable in audit logs.
function encodeMicrosoftClientRequestId(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey).digest();
  // Force RFC 4122 variant (10xxxxxx) and version 5 (sha1-namespace shape;
  // we use sha-256 but the version bits are purely cosmetic for Graph).
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Test seam — replaceable by unit tests that want to assert the random
 * fallback id (used when no caller-supplied idempotency key is available).
 */
const newRandomClientRequestId = (): string => randomUUID();

/**
 * Phase 74 D-05 / D-08 — busy range returned by Outlook's getFreeBusy.
 * Mirrors the GoogleBusyRange shape so pto-detector can be calendar-agnostic.
 */
export interface OutlookBusyRange {
  start: string;
  end: string;
  summary?: string;
  isAllDay?: boolean;
}

// ---------------------------------------------------------------------------
// Outlook Calendar OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Outlook Calendar uses Microsoft Identity Platform (OAuth 2.0).
 *
 * Uses the /common tenant for multi-tenant support.
 *
 * Scopes:
 * - Calendars.ReadWrite — full CRUD on calendar events
 * - offline_access — receive a refresh token
 *
 * IMPORTANT: Microsoft Graph date format must use { dateTime, timeZone }
 * object shape, not ISO 8601 strings directly (Pitfall 5).
 *
 * Env vars required:
 * - OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET — for OAuth
 * - OUTLOOK_ENCRYPTION_KEY — for credential encryption at rest
 */
const OUTLOOK_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: 'OUTLOOK_CLIENT_ID',
  clientSecretEnvVar: 'OUTLOOK_CLIENT_SECRET',
  authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: ['Calendars.ReadWrite', 'offline_access'],
  redirectPath: '/api/oauth/outlook/callback',
};

// ---------------------------------------------------------------------------
// Outlook Calendar Adapter
// ---------------------------------------------------------------------------

export class OutlookCalendarAdapter extends BaseAdapter {
  readonly slug = 'outlook-calendar';
  readonly displayName = 'Outlook Calendar';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return OUTLOOK_OAUTH_CONFIG;
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET environment variables are required',
      );
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri,
              scope: OUTLOOK_OAUTH_CONFIG.scopes.join(' '),
            }),
          },
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      // Authorization-code redemption is non-idempotent.
      { provider: 'outlook-calendar', retryAttempts: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Outlook Calendar OAuth exchange failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      outlookTokenResponseSchema,
      'outlook-calendar:exchangeCodeForTokens',
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
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET environment variables are required',
      );
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Outlook Calendar');
    }
    const refreshToken = credentials.refreshToken;

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              scope: OUTLOOK_OAUTH_CONFIG.scopes.join(' '),
            }),
          },
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'outlook-calendar' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Outlook Calendar token refresh failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      outlookTokenResponseSchema,
      'outlook-calendar:refreshToken',
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Calendar Event CRUD
  // -------------------------------------------------------------------------

  /**
   * Creates a calendar event using Microsoft Graph API.
   *
   * IMPORTANT: Dates must use the { dateTime, timeZone } object format,
   * not raw ISO strings (Pitfall 5).
   *
   * F-INT-04 idempotency: when the caller supplies `idempotencyKey`, it is
   * derived into a deterministic UUID and sent on the `client-request-id`
   * Graph header. Same input key → same id, so duplicate inserts are
   * reconcilable in Graph telemetry and the transport layer can safely
   * retry without losing trace correlation. Callers derive the key as e.g.
   * `sha256(`${orgId}:${calendarId}:${entityId}:create`)`.
   *
   * @param accessToken - The OAuth access token
   * @param event - Event details
   * @param idempotencyKey - Optional deterministic dedup key; encoded into
   *   the `client-request-id` header so retries share the same correlation
   *   id. When omitted, a random UUID is used (no idempotency benefit).
   * @returns Created event ID and web link
   */
  async createEvent(
    accessToken: string,
    event: {
      subject: string;
      bodyHtml?: string;
      startDateTime: string;
      endDateTime: string;
      attendees?: string[];
    },
    idempotencyKey?: string,
  ): Promise<{ eventId: string; webLink: string }> {
    const body: Record<string, unknown> = {
      subject: event.subject,
      start: {
        dateTime: event.startDateTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.endDateTime,
        timeZone: 'UTC',
      },
    };

    if (event.bodyHtml) {
      body.body = {
        contentType: 'HTML',
        content: event.bodyHtml,
      };
    }

    if (event.attendees?.length) {
      body.attendees = event.attendees.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    const clientRequestId = idempotencyKey
      ? encodeMicrosoftClientRequestId(idempotencyKey)
      : newRandomClientRequestId();

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://graph.microsoft.com/v1.0/me/calendar/events',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'client-request-id': clientRequestId,
            },
            body: JSON.stringify(body),
          },
          { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
        ),
      // Without a deterministic key, a transport retry could create a second
      // event. With a key, the client-request-id correlates duplicates and the
      // outer resilience layer can safely retry.
      {
        provider: 'outlook-calendar',
        retryAttempts: idempotencyKey ? MUTATION_RETRIES : 0,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Outlook Calendar create event failed: ${text}`);
    }

    const data = (await response.json()) as {
      id: string;
      webLink: string;
    };

    return {
      eventId: data.id,
      webLink: data.webLink,
    };
  }

  /**
   * Updates an existing calendar event using Microsoft Graph API.
   *
   * @param accessToken - The OAuth access token
   * @param eventId - The event ID to update
   * @param event - Updated event details
   * @returns Updated event ID and web link
   */
  async updateEvent(
    accessToken: string,
    eventId: string,
    event: {
      subject?: string;
      bodyHtml?: string;
      startDateTime?: string;
      endDateTime?: string;
      attendees?: string[];
    },
  ): Promise<{ eventId: string; webLink: string }> {
    const body: Record<string, unknown> = {};

    if (event.subject !== undefined) body.subject = event.subject;
    if (event.bodyHtml !== undefined) {
      body.body = {
        contentType: 'HTML',
        content: event.bodyHtml,
      };
    }
    if (event.startDateTime) {
      body.start = {
        dateTime: event.startDateTime,
        timeZone: 'UTC',
      };
    }
    if (event.endDateTime) {
      body.end = {
        dateTime: event.endDateTime,
        timeZone: 'UTC',
      };
    }
    if (event.attendees?.length) {
      body.attendees = event.attendees.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'client-request-id': newRandomClientRequestId(),
            },
            body: JSON.stringify(body),
          },
          { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
        ),
      // PATCH on a stable eventId is idempotent — replaying the same partial
      // update yields the same final state. Safe to retry.
      { provider: 'outlook-calendar', retryAttempts: MUTATION_RETRIES },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Outlook Calendar update event failed: ${text}`);
    }

    const data = (await response.json()) as {
      id: string;
      webLink: string;
    };

    return {
      eventId: data.id,
      webLink: data.webLink,
    };
  }

  /**
   * Deletes a calendar event using Microsoft Graph API.
   *
   * F-INT-04: DELETE on a stable eventId is naturally idempotent — Graph
   * returns 404 on the second call and the caller already treats both 2xx
   * and 404 as success. Safe to retry on transport errors.
   *
   * @param accessToken - The OAuth access token
   * @param eventId - The event ID to delete
   */
  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const response = await withResilience(
      () =>
        fetchWithTimeout(
          `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'client-request-id': newRandomClientRequestId(),
            },
          },
          { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'outlook-calendar', retryAttempts: MUTATION_RETRIES },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Outlook Calendar delete event failed: ${text}`);
    }
  }

  /**
   * Phase 74 D-05 / D-08 — fetch free-busy ranges via Microsoft Graph
   * `/me/calendar/getSchedule`. Filters status to busy/oof so free /
   * tentative entries don't trigger PTO false-positives.
   *
   * Access token is never included in error messages.
   */
  async getFreeBusy(
    accessToken: string,
    args: { calendarId?: string; timeMin: string; timeMax: string },
  ): Promise<{ busy: OutlookBusyRange[] }> {
    // getSchedule is a read-only POST — safe to retry under withResilience.
    const resp = await withResilience(
      () =>
        fetchWithTimeout(
          'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              schedules: [args.calendarId ?? 'me'],
              startTime: { dateTime: args.timeMin, timeZone: 'UTC' },
              endTime: { dateTime: args.timeMax, timeZone: 'UTC' },
              availabilityViewInterval: 60,
            }),
          },
          { timeoutMs: READ_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'outlook-calendar', retryAttempts: READ_RETRIES },
    );
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Outlook getSchedule failed (${resp.status}): ${body}`);
    }
    const parsed = await safeParseJsonResponse(resp, graphScheduleSchema, 'outlook-calendar:getFreeBusy');
    // A drifted body degrades to "no busy ranges" rather than surfacing junk.
    const items = parsed.success ? (parsed.data.value?.[0]?.scheduleItems ?? []) : [];
    return {
      busy: items
        .filter(i => i.status === 'busy' || i.status === 'oof')
        .map(i => ({
          start: i.start.dateTime,
          end: i.end.dateTime,
          summary: i.subject,
          isAllDay: Boolean(i.isAllDay),
        })),
    };
  }

  // -------------------------------------------------------------------------
  // Health Status — uses BaseAdapter default (no custom behavior).
  // -------------------------------------------------------------------------
}
