import { prisma } from '@contractor-ops/db';
import type { CredentialBlob } from '../types/credentials.js';
import type { ProviderHealthStatus } from '../types/health.js';
import type { IntegrationProviderAdapter, OAuthConfig } from '../types/provider.js';
import type { WebhookVerificationResult } from '../types/webhook.js';

// ---------------------------------------------------------------------------
// Base Adapter
// ---------------------------------------------------------------------------

/**
 * Options for the shared {@link BaseAdapter.getHealthStatus} implementation.
 */
export interface GetHealthStatusOptions {
  /**
   * Connection statuses (besides `CONNECTED`) that should be considered
   * "healthy enough" to participate in the standard derivation rather than
   * be reported as `DISCONNECTED`. For example Linear allows a connection
   * to sit in `PENDING_MAPPING` between OAuth and team selection.
   */
  allowedConnectedStatuses?: readonly string[];
  /**
   * Whether to surface `tokenExpiresAt` and treat an expired token as
   * `REAUTH_REQUIRED`. Defaults to true. Adapters that authenticate with a
   * non-expiring API key (KSeF, Clockify) pass false.
   */
  includeTokenExpiry?: boolean;
}

const DEFAULT_HEALTH_OPTIONS: Required<GetHealthStatusOptions> = {
  allowedConnectedStatuses: [],
  includeTokenExpiry: true,
};

/**
 * Abstract base class providing default no-op implementations
 * for optional IntegrationProviderAdapter methods.
 *
 * Concrete adapters extend this and override only the methods
 * relevant to their capabilities.
 */
export abstract class BaseAdapter implements IntegrationProviderAdapter {
  abstract readonly slug: string;
  abstract readonly displayName: string;
  abstract readonly supportsOAuth: boolean;
  abstract readonly supportsWebhooks: boolean;

  getOAuthConfig?(): OAuthConfig;

  exchangeCodeForTokens?(_code: string, _redirectUri: string): Promise<CredentialBlob>;

  refreshToken?(_credentials: CredentialBlob): Promise<CredentialBlob>;

  verifyWebhookSignature?(
    _rawBody: string,
    _headers: Record<string, string>,
  ): WebhookVerificationResult;

  handleWebhook?(
    _payload: unknown,
    _organizationId: string,
    _connectionId: string,
  ): Promise<unknown>;

  /**
   * Default health-status implementation. Reads the connection row, the
   * five most recent sync logs, and the count of failed syncs in the last
   * 24h, then derives a status.
   *
   * Override only when an adapter needs custom logic beyond what
   * {@link GetHealthStatusOptions} captures.
   */
  async getHealthStatus(
    connectionId: string,
    options?: GetHealthStatusOptions,
  ): Promise<ProviderHealthStatus> {
    const { allowedConnectedStatuses, includeTokenExpiry } = {
      ...DEFAULT_HEALTH_OPTIONS,
      ...options,
    };

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
        provider: this.slug,
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

    const isConnectedStatus =
      connection.status === 'CONNECTED' || allowedConnectedStatuses.includes(connection.status);

    let status: ProviderHealthStatus['status'];
    if (!isConnectedStatus) {
      status = 'DISCONNECTED';
    } else if (connection.lastErrorAt && !connection.lastSuccessAt) {
      status = 'ERROR';
    } else if (
      includeTokenExpiry &&
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt < new Date()
    ) {
      status = 'REAUTH_REQUIRED';
    } else if (recentSyncs[0]?.status === 'FAILED') {
      status = 'ERROR';
    } else {
      status = 'CONNECTED';
    }

    return {
      status,
      provider: this.slug,
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      lastSuccessAt: connection.lastSuccessAt,
      lastErrorAt: connection.lastErrorAt,
      lastErrorMessage: connection.lastErrorMessage,
      tokenExpiresAt: includeTokenExpiry ? connection.tokenExpiresAt : undefined,
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
