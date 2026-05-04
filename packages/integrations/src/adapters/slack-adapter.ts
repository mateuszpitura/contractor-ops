import { createHmac, timingSafeEqual } from 'node:crypto';
import { pLimit, type LimitFunction } from '../services/concurrency.js';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import type { WebhookVerificationResult } from '../types/webhook.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// F-INT-12 — per-channel self-throttle for chat.postMessage
// ---------------------------------------------------------------------------
//
// Slack documents a 1 req/sec limit per channel for `chat.postMessage`
// (https://api.slack.com/methods/chat.postMessage#rate_limiting). When the
// app fans out a bulk reminder (e.g. monthly trial-end) all messages flush
// concurrently which earns 429s + lengthening Retry-After windows. We
// serialize per channel via a `p-limit(1)` instance keyed on the channel
// id, and pace each call with at least 1.05s wall-clock between sends so
// we never exceed the documented budget.
//
// State is per-process. Across instances, slack will still 429 occasionally
// — the resilience layer's retry+jitter handles that without us needing
// cross-process coordination.
const SLACK_PER_CHANNEL_LIMITERS = new Map<string, LimitFunction>();
const SLACK_PER_CHANNEL_NEXT_SEND_AT = new Map<string, number>();
const SLACK_MIN_INTERVAL_MS = 1_050;

/**
 * Acquire (or create) a per-channel limiter so concurrent senders to the
 * same channel are serialized. Different channels run in parallel.
 */
function getSlackChannelLimiter(channel: string): LimitFunction {
  let limit = SLACK_PER_CHANNEL_LIMITERS.get(channel);
  if (!limit) {
    limit = pLimit(1);
    SLACK_PER_CHANNEL_LIMITERS.set(channel, limit);
  }
  return limit;
}

/**
 * Sleep until the next send is allowed for `channel`. Updates the next-send
 * timestamp atomically inside the channel's limiter window so concurrent
 * callers each wait their turn.
 */
async function awaitSlackChannelSlot(channel: string): Promise<void> {
  const now = Date.now();
  const nextAt = SLACK_PER_CHANNEL_NEXT_SEND_AT.get(channel) ?? 0;
  const wait = nextAt - now;
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  SLACK_PER_CHANNEL_NEXT_SEND_AT.set(channel, Math.max(now, nextAt) + SLACK_MIN_INTERVAL_MS);
}

/**
 * Test-only reset of the per-channel throttle state. Production code
 * relies on the module-scoped Maps living for the process lifetime.
 */
export function resetSlackThrottleForTests(): void {
  SLACK_PER_CHANNEL_LIMITERS.clear();
  SLACK_PER_CHANNEL_NEXT_SEND_AT.clear();
}

// ---------------------------------------------------------------------------
// Slack Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Slack.
 *
 * Supports:
 * - OAuth 2.0 (V2) for bot token installation
 * - Webhook signature verification (HMAC-SHA256 with timing-safe comparison)
 * - Webhook processing (block_actions, view_submission)
 *
 * Env vars required:
 * - SLACK_SIGNING_SECRET — for webhook signature verification
 * - SLACK_CLIENT_ID, SLACK_CLIENT_SECRET — for OAuth
 */
export class SlackAdapter extends BaseAdapter {
  readonly slug = 'slack';
  readonly displayName = 'Slack';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return {
      clientIdEnvVar: 'SLACK_CLIENT_ID',
      clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['chat:write', 'users:read', 'users:read.email', 'im:write'],
      redirectPath: '/api/oauth/slack/callback',
    };
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error('SLACK_CLIENT_ID and SLACK_CLIENT_SECRET environment variables are required');
    }

    const response = await fetchWithTimeout(
      'https://slack.com/api/oauth.v2.access',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
      // Authorization-code redemption is non-idempotent — bound wall-clock,
      // no retries.
      { timeoutMs: 30_000, retries: 0 },
    );

    const data = (await response.json()) as {
      ok: boolean;
      access_token?: string;
      team?: { id?: string; name?: string };
      error?: string;
    };

    if (!(data.ok && data.access_token)) {
      throw new Error(`Slack OAuth exchange failed: ${data.error ?? 'unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      tokenType: 'bearer',
      scope: 'chat:write,users:read,users:read.email,im:write',
      extra: {
        teamId: data.team?.id ?? null,
        teamName: data.team?.name ?? null,
      },
    };
  }

  /**
   * Slack bot tokens don't expire — return credentials unchanged.
   */
  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    return credentials;
  }

  // -------------------------------------------------------------------------
  // Webhook Verification
  // -------------------------------------------------------------------------

  /**
   * Verifies Slack webhook signature using HMAC-SHA256 with timing-safe comparison.
   *
   * Required headers: x-slack-request-timestamp, x-slack-signature
   * Required env: SLACK_SIGNING_SECRET
   */
  override verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      return { valid: false };
    }

    const timestamp = headers['x-slack-request-timestamp'] ?? '';
    const signature = headers['x-slack-signature'] ?? '';

    if (!(timestamp && signature)) {
      return { valid: false };
    }

    // Check timestamp freshness (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) {
      return { valid: false };
    }

    // Compute expected signature
    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const mySignature = `v0=${createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')}`;

    // Timing-safe comparison
    const myBuffer = Buffer.from(mySignature);
    const slackBuffer = Buffer.from(signature);

    if (myBuffer.length !== slackBuffer.length) {
      return { valid: false };
    }

    if (!timingSafeEqual(myBuffer, slackBuffer)) {
      return { valid: false };
    }

    // Parse event type from the form-encoded payload
    let eventType = 'unknown';
    try {
      const formParams = new URLSearchParams(rawBody);
      const payloadStr = formParams.get('payload');
      if (payloadStr) {
        const payload = JSON.parse(payloadStr) as { type?: string };
        eventType = payload.type ?? 'unknown';
      }
    } catch {
      // If parsing fails, keep eventType as "unknown"
    }

    // Note: organizationId resolution from Slack team_id via ExternalLink lookup
    // happens in the webhook route layer, not here — the adapter only verifies
    // the cryptographic signature.
    return {
      valid: true,
      eventType,
    };
  }

  // -------------------------------------------------------------------------
  // Outbound — chat.postMessage (with per-channel self-throttle)
  // -------------------------------------------------------------------------

  /**
   * F-INT-12 — Send a message to a Slack channel, respecting the documented
   * 1 req/sec per-channel rate limit on `chat.postMessage`.
   *
   * Outer composition:
   *   per-channel p-limit(1)         -> serialize calls to the same channel
   *     await min-interval gap        -> pace at >=1.05s between sends
   *       withResilience('slack')     -> breaker + retry + bulkhead
   *         fetchWithTimeout          -> wall-clock + Retry-After honoring
   *
   * Different channels run concurrently up to the resilience layer's slack
   * concurrency cap (3 by default) so a fan-out across many channels still
   * makes forward progress.
   */
  async postMessage(args: {
    accessToken: string;
    channel: string;
    text: string;
    blocks?: unknown[];
    threadTs?: string;
  }): Promise<{ ok: boolean; ts?: string; error?: string }> {
    const { accessToken, channel, text, blocks, threadTs } = args;
    const limiter = getSlackChannelLimiter(channel);
    return limiter(async () => {
      await awaitSlackChannelSlot(channel);
      return withResilience(
        async () => {
          const response = await fetchWithTimeout(
            'https://slack.com/api/chat.postMessage',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                channel,
                text,
                ...(blocks ? { blocks } : {}),
                ...(threadTs ? { thread_ts: threadTs } : {}),
              }),
            },
            { timeoutMs: 15_000, retries: 0 },
          );
          const data = (await response.json()) as { ok: boolean; ts?: string; error?: string };
          if (!data.ok) {
            // Surface known transient errors as throws so the outer breaker
            // / retry loop can react. Permanent errors (`channel_not_found`,
            // `not_authed`) still throw but will be classified non-retryable
            // by the resilience layer's error filter.
            throw new Error(`slack chat.postMessage failed: ${data.error ?? 'unknown'}`);
          }
          return data;
        },
        { provider: 'slack' },
      );
    });
  }

  // -------------------------------------------------------------------------
  // Webhook Processing
  // -------------------------------------------------------------------------

  /**
   * Processes a verified Slack webhook payload.
   * Stub for Plan 02 — full handler wiring (processBlockAction, processViewSubmission)
   * comes in Plan 03 when existing Slack interactivity route is migrated.
   */
  override async handleWebhook(
    payload: unknown,
    _organizationId: string,
    _connectionId: string,
  ): Promise<void> {
    const _typedPayload = payload as { type?: string };
    // Plan 03 will wire processBlockAction and processViewSubmission here
  }
}
