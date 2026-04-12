import { createHmac, timingSafeEqual } from "node:crypto";
import type { CredentialBlob } from "../types/credentials.js";
import type { OAuthConfig } from "../types/provider.js";
import type { WebhookVerificationResult } from "../types/webhook.js";
import { BaseAdapter } from "./base-adapter.js";

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
  readonly slug = "slack";
  readonly displayName = "Slack";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  getOAuthConfig(): OAuthConfig {
    return {
      clientIdEnvVar: "SLACK_CLIENT_ID",
      clientSecretEnvVar: "SLACK_CLIENT_SECRET",
      authorizationUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      scopes: ["chat:write", "users:read", "users:read.email", "im:write"],
      redirectPath: "/api/oauth/slack/callback",
    };
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error("SLACK_CLIENT_ID and SLACK_CLIENT_SECRET environment variables are required");
    }

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      access_token?: string;
      team?: { id?: string; name?: string };
      error?: string;
    };

    if (!(data.ok && data.access_token)) {
      throw new Error(`Slack OAuth exchange failed: ${data.error ?? "unknown error"}`);
    }

    return {
      accessToken: data.access_token,
      tokenType: "bearer",
      scope: "chat:write,users:read,users:read.email,im:write",
      extra: {
        teamId: data.team?.id ?? null,
        teamName: data.team?.name ?? null,
      },
    };
  }

  /**
   * Slack bot tokens don't expire — return credentials unchanged.
   */
  async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    return credentials;
  }

  // -------------------------------------------------------------------------
  // Webhook Verification
  // -------------------------------------------------------------------------

  /**
   * Verifies Slack webhook signature using HMAC-SHA256 with timing-safe comparison.
   * Mirrors the exact logic from apps/web/src/app/api/slack/interactivity/route.ts.
   *
   * Required headers: x-slack-request-timestamp, x-slack-signature
   * Required env: SLACK_SIGNING_SECRET
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      return { valid: false };
    }

    const timestamp = headers["x-slack-request-timestamp"] ?? "";
    const signature = headers["x-slack-signature"] ?? "";

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
    const mySignature = `v0=${createHmac("sha256", signingSecret).update(sigBasestring).digest("hex")}`;

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
    let eventType = "unknown";
    try {
      const formParams = new URLSearchParams(rawBody);
      const payloadStr = formParams.get("payload");
      if (payloadStr) {
        const payload = JSON.parse(payloadStr) as { type?: string };
        eventType = payload.type ?? "unknown";
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
  // Webhook Processing
  // -------------------------------------------------------------------------

  /**
   * Processes a verified Slack webhook payload.
   * Stub for Plan 02 — full handler wiring (processBlockAction, processViewSubmission)
   * comes in Plan 03 when existing Slack interactivity route is migrated.
   */
  async handleWebhook(
    payload: unknown,
    _organizationId: string,
    _connectionId: string,
  ): Promise<void> {
    const _typedPayload = payload as { type?: string };
    // Plan 03 will wire processBlockAction and processViewSubmission here
  }
}
