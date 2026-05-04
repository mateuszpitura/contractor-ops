import { pLimit, type LimitFunction } from '../services/concurrency.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// F-INT-12 — per-conversation self-throttle for outbound Bot Framework calls
// ---------------------------------------------------------------------------
//
// Microsoft Bot Framework's per-bot rate limit is generous (~1800 RPS across
// the bot), but per-conversation throughput is lower — the official guidance
// is to serialize messages to a single conversation and spread fan-outs
// across multiple. We mirror the Slack approach: a `p-limit(2)` per
// conversation key (lets activity + typing indicator interleave), with a
// 250ms gap to avoid per-conversation throttling on bulk sends.
//
// Be additive — this does NOT touch the OAuth credentials/refresh flow.
const TEAMS_PER_CONVERSATION_LIMITERS = new Map<string, LimitFunction>();
const TEAMS_PER_CONVERSATION_NEXT_SEND_AT = new Map<string, number>();
const TEAMS_PER_CONVERSATION_CONCURRENCY = 2;
const TEAMS_MIN_INTERVAL_MS = 250;

/**
 * Acquire (or create) a per-conversation limiter so concurrent senders to
 * the same conversation are bounded. Different conversations run in parallel.
 */
function getTeamsConversationLimiter(conversationId: string): LimitFunction {
  let limit = TEAMS_PER_CONVERSATION_LIMITERS.get(conversationId);
  if (!limit) {
    limit = pLimit(TEAMS_PER_CONVERSATION_CONCURRENCY);
    TEAMS_PER_CONVERSATION_LIMITERS.set(conversationId, limit);
  }
  return limit;
}

/**
 * Sleep until the next send is allowed for `conversationId`.
 */
async function awaitTeamsConversationSlot(conversationId: string): Promise<void> {
  const now = Date.now();
  const nextAt = TEAMS_PER_CONVERSATION_NEXT_SEND_AT.get(conversationId) ?? 0;
  const wait = nextAt - now;
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  TEAMS_PER_CONVERSATION_NEXT_SEND_AT.set(
    conversationId,
    Math.max(now, nextAt) + TEAMS_MIN_INTERVAL_MS,
  );
}

/**
 * F-INT-12 — Wrap an outbound Bot Framework call with the per-conversation
 * throttle. Bot Framework callers (Plan 03) should funnel through this so
 * bulk reminder fan-outs don't burst-throttle a single conversation.
 *
 * @example
 *   await withTeamsConversationThrottle(activity.conversation.id, async () => {
 *     await botAdapter.continueConversation(reference, async (ctx) => {
 *       await ctx.sendActivity(activity);
 *     });
 *   });
 */
export function withTeamsConversationThrottle<T>(
  conversationId: string,
  call: () => Promise<T>,
): Promise<T> {
  const limiter = getTeamsConversationLimiter(conversationId);
  return limiter(async () => {
    await awaitTeamsConversationSlot(conversationId);
    return call();
  });
}

/**
 * Test-only reset of the per-conversation throttle state.
 */
export function resetTeamsThrottleForTests(): void {
  TEAMS_PER_CONVERSATION_LIMITERS.clear();
  TEAMS_PER_CONVERSATION_NEXT_SEND_AT.clear();
}

// ---------------------------------------------------------------------------
// Azure AD / Microsoft Teams OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Microsoft Teams uses Azure AD OAuth 2.0 Authorization Code Grant.
 * The bot communicates via Bot Framework; generic webhooks are not used.
 *
 * Scopes:
 * - Team.ReadBasic.All   -- list joined teams
 * - Channel.ReadBasic.All -- list team channels
 * - User.Read            -- read user profile
 * - offline_access       -- refresh tokens
 */
const TEAMS_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: 'AZURE_BOT_APP_ID',
  clientSecretEnvVar: 'AZURE_BOT_APP_SECRET',
  authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: [
    'https://graph.microsoft.com/Team.ReadBasic.All',
    'https://graph.microsoft.com/Channel.ReadBasic.All',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ],
  redirectPath: '/api/oauth/microsoft_teams/callback',
};

// ---------------------------------------------------------------------------
// Teams Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Microsoft Teams (approval cards, reminders, alerts).
 *
 * Supports:
 * - OAuth 2.0 Authorization Code Grant via Azure AD
 * - Token refresh with AES-256-GCM encrypted credential storage
 * - Health status checks via integration connection state
 *
 * Does NOT use generic webhooks — Bot Framework handles its own messaging
 * channel via the Bot Framework Adapter (see Plan 03).
 *
 * Env vars required:
 * - AZURE_BOT_APP_ID, AZURE_BOT_APP_SECRET — for OAuth + Bot Framework
 * - MICROSOFT_TEAMS_ENCRYPTION_KEY — for credential encryption at rest
 */
export class TeamsAdapter extends BaseAdapter {
  readonly slug = 'microsoft_teams';
  readonly displayName = 'Microsoft Teams';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return TEAMS_OAUTH_CONFIG;
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.AZURE_BOT_APP_ID;
    const clientSecret = process.env.AZURE_BOT_APP_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'AZURE_BOT_APP_ID and AZURE_BOT_APP_SECRET environment variables are required',
      );
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      scope: TEAMS_OAUTH_CONFIG.scopes.join(' '),
    });

    const response = await fetch(TEAMS_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft Teams OAuth exchange failed: ${text}`);
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
    const clientId = process.env.AZURE_BOT_APP_ID;
    const clientSecret = process.env.AZURE_BOT_APP_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'AZURE_BOT_APP_ID and AZURE_BOT_APP_SECRET environment variables are required',
      );
    }

    // The caller (token-refresh.ts:lazyRefresh / refreshExpiring) decrypts
    // the encrypted credential blob BEFORE invoking adapter.refreshToken,
    // so `credentials` is already a CredentialBlob with plaintext tokens.
    // The previous code re-decrypted credentials.accessToken which always
    // threw "Invalid encrypted credentials format" — see jira-adapter.ts
    // refreshToken for the correct pattern.
    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Microsoft Teams');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refreshToken,
      scope: TEAMS_OAUTH_CONFIG.scopes.join(' '),
    });

    const response = await fetch(TEAMS_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft Teams token refresh failed: ${text}`);
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
  // Health Status — uses BaseAdapter default (no custom behavior).
  // -------------------------------------------------------------------------
}
