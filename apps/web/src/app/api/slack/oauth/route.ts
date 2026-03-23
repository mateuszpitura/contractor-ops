/**
 * @deprecated Phase 12: Use /api/oauth/[provider]/callback instead.
 * This route remains for backward compatibility during Slack app URL migration.
 * Remove after Slack app configuration is updated to use the new OAuth callback URL.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@contractor-ops/db";
import {
  encryptToken,
  syncWorkspaceUsers,
} from "@contractor-ops/api/services/slack-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// State verification (HMAC-SHA256 CSRF protection)
// ---------------------------------------------------------------------------

interface OAuthState {
  orgId: string;
  userId: string;
  timestamp: number;
  sig: string;
}

function verifyState(stateParam: string): OAuthState | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf-8"),
    ) as OAuthState;

    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) return null;

    const payload = `${decoded.orgId}:${decoded.userId}:${decoded.timestamp}`;
    const expectedSig = createHmac("sha256", signingSecret)
      .update(payload)
      .digest("hex");

    // Timing-safe comparison
    const sigBuffer = Buffer.from(decoded.sig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    // Check timestamp freshness
    if (Date.now() - decoded.timestamp > STATE_MAX_AGE_MS) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/slack/oauth
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const settingsUrl = (status: string) =>
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings?tab=integrations&slack=${status}`;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");

    if (!code || !stateParam) {
      return NextResponse.redirect(settingsUrl("error"));
    }

    // Verify HMAC-signed state (CSRF protection per pitfall 6)
    const state = verifyState(stateParam);
    if (!state) {
      console.error("[slack-oauth] Invalid or expired state parameter");
      return NextResponse.redirect(settingsUrl("error"));
    }

    // Exchange code for token
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[slack-oauth] Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET");
      return NextResponse.redirect(settingsUrl("error"));
    }

    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/slack/oauth`,
      }),
    });

    const data = (await tokenResponse.json()) as {
      ok: boolean;
      access_token?: string;
      team?: { id?: string; name?: string };
      error?: string;
    };

    if (!data.ok || !data.access_token) {
      console.error("[slack-oauth] Token exchange failed:", data.error);
      return NextResponse.redirect(settingsUrl("error"));
    }

    // Encrypt bot token (never store raw xoxb-)
    const encryptedToken = encryptToken(data.access_token);
    const teamName = data.team?.name ?? "Slack Workspace";
    const teamId = data.team?.id ?? "";

    // Upsert IntegrationConnection
    const existingConnection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId: state.orgId,
        provider: "SLACK",
      },
    });

    let connectionId: string;

    if (existingConnection) {
      await prisma.integrationConnection.update({
        where: { id: existingConnection.id },
        data: {
          status: "CONNECTED",
          displayName: teamName,
          credentialsRef: encryptedToken,
          connectedByUserId: state.userId,
          connectedAt: new Date(),
          configJson: { teamId },
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });
      connectionId = existingConnection.id;
    } else {
      const created = await prisma.integrationConnection.create({
        data: {
          organizationId: state.orgId,
          provider: "SLACK",
          status: "CONNECTED",
          displayName: teamName,
          credentialsRef: encryptedToken,
          connectedByUserId: state.userId,
          configJson: { teamId },
        },
      });
      connectionId = created.id;
    }

    // Auto-sync workspace users by email (D-10)
    try {
      const syncResult = await syncWorkspaceUsers(state.orgId, connectionId);
      console.log(
        `[slack-oauth] User sync complete: ${syncResult.matched}/${syncResult.total} matched`,
      );
    } catch (syncError) {
      console.error("[slack-oauth] User sync failed (non-blocking):", syncError);
    }

    return NextResponse.redirect(settingsUrl("connected"));
  } catch (error) {
    console.error("[slack-oauth] Unexpected error:", error);
    return NextResponse.redirect(settingsUrl("error"));
  }
}
