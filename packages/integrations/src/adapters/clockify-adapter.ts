import { prisma } from "@contractor-ops/db";
import type { ProviderHealthStatus } from "../types/health.js";
import { BaseAdapter } from "./base-adapter.js";

// ---------------------------------------------------------------------------
// Clockify Regional Base URLs (Pitfall 3 from RESEARCH.md)
// ---------------------------------------------------------------------------

/**
 * Clockify uses regional base URLs. Users must select their region
 * during connection setup — API keys are region-specific.
 */
export const CLOCKIFY_REGIONS: Record<string, string> = {
  global: "https://api.clockify.me/api/v1",
  eu: "https://euc1.clockify.me/api/v1",
  us: "https://use2.clockify.me/api/v1",
  uk: "https://euw2.clockify.me/api/v1",
  au: "https://apse2.clockify.me/api/v1",
};

export type ClockifyRegion = keyof typeof CLOCKIFY_REGIONS;

// ---------------------------------------------------------------------------
// Clockify Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Clockify time tracking.
 *
 * Clockify uses API key authentication (not OAuth). The API key is stored
 * as an encrypted credential via the standard credential service. Connection
 * config stores the workspaceId, userId, and region for API calls.
 *
 * Auth: X-Api-Key header with the user's API key.
 *
 * Env vars required:
 * - CLOCKIFY_ENCRYPTION_KEY — for credential encryption at rest
 */
export class ClockifyAdapter extends BaseAdapter {
  readonly slug = "clockify";
  readonly displayName = "Clockify";
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;

  /**
   * Returns health status for a Clockify connection based on
   * recent sync logs (same pattern as KSeF adapter).
   */
  async getHealthStatus(connectionId: string): Promise<ProviderHealthStatus> {
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
        status: true,
      },
    });

    if (!connection) {
      return {
        status: "DISCONNECTED",
        provider: "clockify",
        recentSyncs: [],
        recentWebhooks: [],
        errorCountLast24h: 0,
      };
    }

    // Fetch recent sync logs
    const recentSyncs = await prisma.integrationSyncLog.findMany({
      where: { integrationConnectionId: connectionId },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        syncType: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Count errors in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorCountLast24h = await prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connectionId,
        status: "FAILED",
        startedAt: { gte: oneDayAgo },
      },
    });

    // Determine status
    let status: ProviderHealthStatus["status"];
    if (connection.status !== "CONNECTED") {
      status = "DISCONNECTED";
    } else if (connection.lastErrorAt && !connection.lastSuccessAt) {
      status = "ERROR";
    } else if (recentSyncs.length > 0 && recentSyncs[0]!.status === "FAILED") {
      status = "ERROR";
    } else {
      status = "CONNECTED";
    }

    return {
      status,
      provider: "clockify",
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      lastSuccessAt: connection.lastSuccessAt,
      lastErrorAt: connection.lastErrorAt,
      lastErrorMessage: connection.lastErrorMessage,
      recentSyncs: recentSyncs.map((s) => ({
        id: s.id,
        syncType: s.syncType,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      recentWebhooks: [], // Clockify uses on-demand polling, no webhooks
      errorCountLast24h,
    };
  }
}
