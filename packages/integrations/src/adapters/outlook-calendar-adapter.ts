import { fetchWithTimeout } from '../services/fetch-helpers.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Timeout budgets (F-INT-01 / F-INT-02)
// ---------------------------------------------------------------------------
//
// OAuth token redemption + refresh — non-idempotent POST against Microsoft
// Identity Platform. 30s wall-clock, no retries (replaying can claim
// multiple sessions or invalidate the refresh token).
const OAUTH_TIMEOUT_MS = 30_000;
// Calendar event mutations — POST/PATCH/DELETE against Graph. NOT retried
// by default to avoid duplicate inserts (no Idempotency-Key wiring yet —
// see F-INT-04). 15s wall-clock; helper aborts on transport hangs.
// TODO(F-INT-04): once createEvent passes a deterministic key, opt in to
// retryNonIdempotent.
const MUTATION_TIMEOUT_MS = 15_000;
// getSchedule POST is read-only — opt in to retry on 429/5xx.
const READ_TIMEOUT_MS = 15_000;
const READ_RETRIES = 2;

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

    const response = await fetchWithTimeout(
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
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Outlook Calendar OAuth exchange failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

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

    const response = await fetchWithTimeout(
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
          refresh_token: credentials.refreshToken,
          scope: OUTLOOK_OAUTH_CONFIG.scopes.join(' '),
        }),
      },
      { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Outlook Calendar token refresh failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

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
   * @param accessToken - The OAuth access token
   * @param event - Event details
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

    const response = await fetchWithTimeout(
      'https://graph.microsoft.com/v1.0/me/calendar/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
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

    const response = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
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
   * @param accessToken - The OAuth access token
   * @param eventId - The event ID to delete
   */
  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const response = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      { timeoutMs: MUTATION_TIMEOUT_MS, retries: 0 },
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
    // getSchedule is a read-only POST — opt in to retry on 429/5xx.
    const resp = await fetchWithTimeout(
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
      {
        timeoutMs: READ_TIMEOUT_MS,
        retries: READ_RETRIES,
        retryNonIdempotent: true,
      },
    );
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Outlook getSchedule failed (${resp.status}): ${body}`);
    }
    const data = (await resp.json()) as {
      value?: Array<{
        scheduleItems?: Array<{
          status: string;
          subject?: string;
          start: { dateTime: string };
          end: { dateTime: string };
          isAllDay?: boolean;
        }>;
      }>;
    };
    const items = data.value?.[0]?.scheduleItems ?? [];
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
