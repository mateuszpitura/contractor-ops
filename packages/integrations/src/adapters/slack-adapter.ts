import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { mapErrorClassToResult } from '../idp/deprovision-result.js';
import type { ErrorClass } from '../idp/error-classifier.js';
import { classifyError } from '../idp/error-classifier.js';
import type { ImpactPreview } from '../idp/impact-preview.js';
import { SLACK_DEPROVISION_SCOPES } from '../scopes/slack-deprovision-scopes.js';
import type { LimitFunction } from '../services/concurrency.js';
import { pLimit } from '../services/concurrency.js';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse, safeParseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import {
  canonicalizeRequest,
  canonicalizeResponse,
  sha256Hex,
} from '../services/saga-canonicalize.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';
import type { OAuthConfig } from '../types/provider.js';
import type { WebhookVerificationResult } from '../types/webhook.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * Slack OAuth v2 access response (oauth.v2.access). Validated at the
 * credential-persist boundary so a malformed payload fails closed before the
 * access token is encrypted into the CredentialBlob.
 */
const SlackOAuthAccessResponse = z.object({
  ok: z.boolean(),
  access_token: z.string().optional(),
  team: z.object({ id: z.string().optional(), name: z.string().optional() }).optional(),
  error: z.string().optional(),
});

/**
 * Slack `chat.postMessage` response — only the fields the caller reads.
 * Validated as a transient data-fetch so a drifted body fails the call locally
 * (the outer resilience layer treats the throw as a retryable failure) rather
 * than silently coercing into the cast type.
 */
const SlackPostMessageResponse = z.object({
  ok: z.boolean(),
  ts: z.string().optional(),
  error: z.string().optional(),
});

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
export class SlackAdapter extends BaseAdapter implements Deprovisionable {
  readonly slug = 'slack';
  readonly displayName = 'Slack';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  /**
   * Phase 77 D-14 — the org-grid (org-level) token used EXCLUSIVELY by the
   * Deprovisionable methods (SCIM deactivate + admin.users.session.invalidate).
   * The saga step-runner (77-04) resolves it from the SLACK_ORG_GRID connection
   * and configures it via {@link withOrgGridToken}. The deprovision methods NEVER
   * fall back to the workspace bot token (D-14 / T-77-03-01).
   */
  #orgGridToken = '';

  /** Configure the org-grid token for the Deprovisionable methods (saga step-runner). */
  withOrgGridToken(token: string): this {
    this.#orgGridToken = token;
    return this;
  }

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

  /**
   * Phase 77 D-14 — org-grid OAuth config for the deprovisioning connection.
   * Distinct from the workspace {@link getOAuthConfig}: org-level scopes from the
   * typed-const ({@link SLACK_DEPROVISION_SCOPES}) and a separate redirect path.
   */
  getOrgGridOAuthConfig(): OAuthConfig {
    return {
      clientIdEnvVar: 'SLACK_CLIENT_ID',
      clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: [...SLACK_DEPROVISION_SCOPES],
      redirectPath: '/api/oauth/slack-org-grid/callback',
      connectionSubKind: 'SLACK_ORG_GRID',
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

    const data = await parseJsonResponse(
      response,
      SlackOAuthAccessResponse,
      'slack:exchangeCodeForTokens',
    );

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
      // safe-swallow: Slack payload parse best-effort; eventType defaults to "unknown"
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
          const parsed = await safeParseJsonResponse(
            response,
            SlackPostMessageResponse,
            'slack:postMessage',
          );
          if (!parsed.success) {
            // A malformed/drifted body cannot be trusted — surface as a throw so
            // the outer breaker / retry loop can react.
            throw new Error('slack chat.postMessage returned an unexpected response body');
          }
          const data = parsed.data;
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

  // -------------------------------------------------------------------------
  // Deprovisionable (Phase 77 D-05/D-08/D-14) — SCIM deactivate + session invalidate.
  // SCIM + admin.session calls use the ORG-GRID token exclusively (never the
  // workspace bot token). Errors map through the closed-enum classifier.
  // -------------------------------------------------------------------------

  /** SCIM request helper (Enterprise Grid SCIM v2) with the org-grid bearer token. */
  async #scimFetch(path: string, init: RequestInit): Promise<Response> {
    return withResilience(
      () =>
        fetchWithTimeout(
          `https://api.slack.com/scim/v2${path}`,
          {
            ...init,
            headers: {
              Authorization: `Bearer ${this.#orgGridToken}`,
              'Content-Type': 'application/scim+json',
              ...(init.headers ?? {}),
            },
          },
          { timeoutMs: 15_000, retries: 0 },
        ),
      { provider: 'slack' },
    );
  }

  /** Slack admin Web-API call (JSON body, org-grid bearer token). */
  async #adminApi(method: string, body: Record<string, unknown>): Promise<Response> {
    return withResilience(
      () =>
        fetchWithTimeout(
          `https://slack.com/api/${method}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.#orgGridToken}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(body),
          },
          { timeoutMs: 15_000, retries: 0 },
        ),
      { provider: 'slack' },
    );
  }

  /** Maps a Slack web-API `{ ok:false, error }` code to an ErrorClass. */
  static #classifySlackError(httpStatus: number, slackError?: string): ErrorClass {
    if (slackError === 'ratelimited') return classifyError({ httpStatus: 429 });
    if (slackError === 'users_not_found' || slackError === 'user_not_found') {
      return classifyError({ httpStatus: 404 });
    }
    if (
      slackError === 'not_authed' ||
      slackError === 'token_expired' ||
      slackError === 'invalid_auth'
    ) {
      return classifyError({ httpStatus: 401 });
    }
    if (
      slackError === 'missing_scope' ||
      slackError === 'cannot_perform_operation' ||
      slackError === 'not_allowed_token_type'
    ) {
      return classifyError({ httpStatus: 403, providerErrorCode: slackError });
    }
    return classifyError({ httpStatus, providerErrorCode: slackError });
  }

  /** Resolves a SCIM user id from an email or passes through a Slack user id. */
  async #resolveScimUserId(externalUserId: string): Promise<string | null> {
    if (!externalUserId.includes('@')) return externalUserId; // already a Slack user id
    const res = await this.#scimFetch(
      `/Users?filter=${encodeURIComponent(`userName eq "${externalUserId}"`)}`,
      { method: 'GET' },
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { Resources?: Array<{ id?: string }> };
    return body.Resources?.[0]?.id ?? null;
  }

  async suspendAccount(externalUserId: string): Promise<DeprovisionResult> {
    const patchBody = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace', path: 'active', value: false }],
    };
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ method: 'PATCH', target: 'scim.active', body: patchBody }),
    );

    const scimUserId = await this.#resolveScimUserId(externalUserId);
    if (scimUserId === null) {
      return {
        status: 'LIKELY_GONE',
        skipped: false,
        reason: 'user_not_found',
        failureKind: 'USER_NOT_FOUND',
        errorClass: 'PERMANENT_NOT_FOUND',
        requestSha256,
        responseSha256: sha256Hex(canonicalizeResponse({ resolved: false })),
      };
    }

    const res = await this.#scimFetch(`/Users/${encodeURIComponent(scimUserId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patchBody),
    });
    const body = await res.json().catch(() => ({}));
    const responseSha256 = sha256Hex(canonicalizeResponse({ status: res.status, body }));

    if (res.ok) return { status: 'SUCCEEDED', requestSha256, responseSha256 };

    const scimError = (body as { detail?: string; scimType?: string }).scimType;
    return this.#mapSlackFailure(res.status, scimError, requestSha256, responseSha256);
  }

  async revokeAllSessions(externalUserId: string): Promise<DeprovisionResult> {
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ method: 'POST', target: 'admin.users.session.invalidate' }),
    );
    const res = await this.#adminApi('admin.users.session.invalidate', { user_id: externalUserId });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    const responseSha256 = sha256Hex(canonicalizeResponse({ ok: body.ok, error: body.error }));

    if (res.ok && body.ok) return { status: 'SUCCEEDED', requestSha256, responseSha256 };
    return this.#mapSlackFailure(res.status, body.error, requestSha256, responseSha256);
  }

  async verifyDeprovisioned(externalUserId: string): Promise<boolean> {
    const res = await this.#adminApi('users.info', { user: externalUserId });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      user?: { deleted?: boolean };
    };
    if (body.ok && body.user?.deleted === true) return true;
    // user_not_found / users_not_found ⇒ already gone (LIKELY_GONE precursor).
    return body.error === 'user_not_found' || body.error === 'users_not_found';
  }

  async describeImpact(externalUserId: string): Promise<ImpactPreview> {
    const cacheKey = `co:idp:preview:SLACK:${externalUserId}`;
    const fetchedAt = new Date().toISOString();

    const baseCommon = {
      externalUserId,
      externalUserDisplayName: externalUserId,
      accountStatus: 'ACTIVE' as const,
      sessionCount: null,
    };

    // users.info — accountStatus + admin/owner booleans + display name.
    const infoRes = await this.#adminApi('users.info', { user: externalUserId });
    const info = (await infoRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      user?: {
        deleted?: boolean;
        is_admin?: boolean;
        is_owner?: boolean;
        is_primary_owner?: boolean;
        profile?: { real_name?: string; display_name?: string };
      };
    };

    // Enterprise-Grid pre-flight: cannot_perform_operation ⇒ not on Grid (non-fatal, D-08/D-16).
    if (info.error === 'cannot_perform_operation') {
      return {
        provider: 'SLACK',
        commonMetrics: { ...baseCommon, accountStatus: 'NOT_FOUND' },
        customMetrics: {
          channelsMemberCount: null,
          ownedChannelCount: null,
          installedAppCount: null,
          isWorkspaceAdmin: false,
          isOrgOwner: false,
          error: 'NOT_ON_ENTERPRISE_GRID',
        },
        fetchedAt,
        cacheKey,
      };
    }

    const user = info.user;
    const accountStatus: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND' = info.ok
      ? user?.deleted
        ? 'SUSPENDED'
        : 'ACTIVE'
      : 'NOT_FOUND';

    // users.conversations — channelsMemberCount (capped, best-effort → null on failure).
    let channelsMemberCount: number | null = null;
    try {
      const convRes = await this.#adminApi('users.conversations', {
        user: externalUserId,
        types: 'public_channel,private_channel',
        limit: 200,
      });
      const conv = (await convRes.json().catch(() => ({}))) as {
        ok?: boolean;
        channels?: unknown[];
      };
      if (conv.ok && Array.isArray(conv.channels)) channelsMemberCount = conv.channels.length;
    } catch {
      channelsMemberCount = null;
    }

    // apps.permissions.users.list — installedAppCount (best-effort → null).
    let installedAppCount: number | null = null;
    try {
      const appsRes = await this.#adminApi('apps.permissions.users.list', { user: externalUserId });
      const apps = (await appsRes.json().catch(() => ({}))) as { ok?: boolean; apps?: unknown[] };
      if (apps.ok && Array.isArray(apps.apps)) installedAppCount = apps.apps.length;
    } catch {
      installedAppCount = null;
    }

    return {
      provider: 'SLACK',
      commonMetrics: {
        ...baseCommon,
        accountStatus,
        externalUserDisplayName:
          user?.profile?.real_name ?? user?.profile?.display_name ?? externalUserId,
      },
      customMetrics: {
        channelsMemberCount,
        ownedChannelCount: null,
        installedAppCount,
        isWorkspaceAdmin: Boolean(user?.is_admin),
        isOrgOwner: Boolean(user?.is_owner || user?.is_primary_owner),
        error: null,
      },
      fetchedAt,
      cacheKey,
    };
  }

  /** Maps a non-OK Slack deprovision outcome to a DeprovisionResult (TRANSIENT_* throws). */
  #mapSlackFailure(
    httpStatus: number,
    slackError: string | undefined,
    requestSha256: string,
    responseSha256: string,
  ): DeprovisionResult {
    const errorClass = SlackAdapter.#classifySlackError(httpStatus, slackError);
    return mapErrorClassToResult(errorClass, {
      requestSha256,
      responseSha256,
      notFoundReason: 'user_not_found',
      transientDetail: `slack transient failure (${httpStatus}/${slackError ?? errorClass})`,
      failedDetail: `slack deprovision failed (${httpStatus}/${slackError ?? errorClass})`,
    });
  }
}
