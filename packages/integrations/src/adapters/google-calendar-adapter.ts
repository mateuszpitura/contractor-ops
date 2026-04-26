import { prisma } from '@contractor-ops/db';
import type { CredentialBlob } from '../types/credentials.js';
import type { ProviderHealthStatus } from '../types/health.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

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

    const response = await fetch('https://oauth2.googleapis.com/token', {
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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar OAuth exchange failed: ${text}`);
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

    const response = await fetch('https://oauth2.googleapis.com/token', {
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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar token refresh failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

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
   * @param accessToken - The OAuth access token
   * @param event - Event details
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

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
   * Uses `If-Match` header with etag for optimistic concurrency control (Pitfall 4).
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

    const response = await fetch(
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
   * @param accessToken - The OAuth access token
   * @param eventId - The event ID to delete
   */
  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar delete event failed: ${text}`);
    }
  }

  // -------------------------------------------------------------------------
  // Health Status
  // -------------------------------------------------------------------------

  override async getHealthStatus(connectionId: string): Promise<ProviderHealthStatus> {
    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      select: {
        provider: true,
        displayName: true,
        connectedAt: true,
        lastSyncAt: true,
        lastSuccessAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
        tokenExpiresAt: true,
        status: true,
      },
    });

    if (!connection) {
      return {
        status: 'DISCONNECTED',
        provider: 'google-calendar',
        recentSyncs: [],
        recentWebhooks: [],
        errorCountLast24h: 0,
      };
    }

    const recentSyncs = await prisma.integrationSyncLog.findMany({
      where: { integrationConnectionId: connectionId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        syncType: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorCountLast24h = await prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connectionId,
        status: 'FAILED',
        startedAt: { gte: oneDayAgo },
      },
    });

    let status: ProviderHealthStatus['status'];
    if (connection.status !== 'CONNECTED') {
      status = 'DISCONNECTED';
    } else if (connection.lastErrorAt && !connection.lastSuccessAt) {
      status = 'ERROR';
    } else if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      status = 'REAUTH_REQUIRED';
    } else if (recentSyncs[0]?.status === 'FAILED') {
      status = 'ERROR';
    } else {
      status = 'CONNECTED';
    }

    return {
      status,
      provider: 'google-calendar',
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      lastSuccessAt: connection.lastSuccessAt,
      lastErrorAt: connection.lastErrorAt,
      lastErrorMessage: connection.lastErrorMessage,
      tokenExpiresAt: connection.tokenExpiresAt,
      recentSyncs: recentSyncs.map(s => ({
        id: s.id,
        syncType: s.syncType,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      recentWebhooks: [],
      errorCountLast24h,
    };
  }
}
