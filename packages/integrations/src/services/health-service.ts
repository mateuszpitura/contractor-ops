import { prisma } from '@contractor-ops/db';
import { getAllAdapters } from '../registry.js';
import type { ProviderHealthStatus } from '../types/health.js';

// ---------------------------------------------------------------------------
// Health Service — aggregates provider connection health from multiple sources
// ---------------------------------------------------------------------------

/**
 * Retrieves the health status for a single provider connection.
 * Aggregates data from IntegrationConnection, IntegrationSyncLog,
 * and WebhookDelivery to build a complete health snapshot.
 *
 * @param organizationId - The organization to check
 * @param providerSlug - The provider slug (e.g., "slack", "jira")
 * @returns Full health status including recent syncs, webhooks, and error counts
 */
export async function getProviderHealth(
  organizationId: string,
  providerSlug: string,
): Promise<ProviderHealthStatus> {
  const providerEnum = providerSlug.toUpperCase() as Parameters<
    typeof prisma.integrationConnection.findFirst
  >[0] extends { where?: { provider?: infer P } }
    ? P
    : never;

  const connection = await prisma.integrationConnection.findFirst({
    where: { organizationId, provider: providerEnum },
    include: { connectedBy: { select: { id: true, name: true } } },
  });

  if (!connection) {
    return {
      status: 'DISCONNECTED',
      provider: providerSlug,
      displayName: null,
      connectedAt: null,
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      tokenExpiresAt: null,
      recentSyncs: [],
      recentWebhooks: [],
      errorCountLast24h: 0,
    };
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentSyncs, recentWebhooks, errorCount] = await Promise.all([
    prisma.integrationSyncLog.findMany({
      where: { integrationConnectionId: connection.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        syncType: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.webhookDelivery.findMany({
      where: { organizationId, provider: providerEnum },
      orderBy: { receivedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        eventType: true,
        deliveryStatus: true,
        receivedAt: true,
        processedAt: true,
      },
    }),
    prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connection.id,
        status: 'FAILED',
        startedAt: { gte: twentyFourHoursAgo },
      },
    }),
  ]);

  return {
    status: connection.status as ProviderHealthStatus['status'],
    provider: providerSlug,
    displayName: connection.displayName,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
    lastSuccessAt: connection.lastSuccessAt,
    lastErrorAt: connection.lastErrorAt,
    lastErrorMessage: connection.lastErrorMessage,
    tokenExpiresAt: connection.tokenExpiresAt,
    recentSyncs,
    recentWebhooks,
    errorCountLast24h: errorCount,
  };
}

/**
 * Retrieves health status for all registered provider adapters.
 * Returns one ProviderHealthStatus per adapter, even if disconnected.
 *
 * @param organizationId - The organization to check
 * @returns Array of health statuses for all registered providers
 */
export async function getAllProviderHealth(
  organizationId: string,
): Promise<ProviderHealthStatus[]> {
  const adapters = getAllAdapters();
  return Promise.all(adapters.map(a => getProviderHealth(organizationId, a.slug)));
}
