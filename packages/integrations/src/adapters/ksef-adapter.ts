import { prisma } from '@contractor-ops/db';
import type { ProviderHealthStatus } from '../types/health.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// KSeF Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for KSeF (Krajowy System e-Faktur).
 *
 * KSeF uses token/certificate-based authentication (not OAuth) and
 * polling-based invoice sync (not webhooks). This adapter provides
 * health status checks via the integration sync log.
 */
export class KsefAdapter extends BaseAdapter {
  readonly slug = 'ksef';
  readonly displayName = 'KSeF';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;

  /**
   * Returns health status for a KSeF connection based on
   * recent sync logs.
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
        tokenExpiresAt: true,
        status: true,
      },
    });

    if (!connection) {
      return {
        status: 'DISCONNECTED',
        provider: 'ksef',
        recentSyncs: [],
        recentWebhooks: [],
        errorCountLast24h: 0,
      };
    }

    // Fetch recent sync logs
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

    // Count errors in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorCountLast24h = await prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connectionId,
        status: 'FAILED',
        startedAt: { gte: oneDayAgo },
      },
    });

    // Determine status
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
      provider: 'ksef',
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
      recentWebhooks: [], // KSeF does not use webhooks
      errorCountLast24h,
    };
  }
}
