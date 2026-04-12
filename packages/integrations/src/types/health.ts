/**
 * Health status snapshot for a provider connection.
 * Aggregates connection state, recent activity, and error counts.
 */
export interface ProviderHealthStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'REAUTH_REQUIRED';
  provider: string;
  displayName?: string | null;
  connectedAt?: Date | null;
  lastSyncAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastErrorAt?: Date | null;
  lastErrorMessage?: string | null;
  tokenExpiresAt?: Date | null;
  recentSyncs: Array<{
    id: string;
    syncType: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
  }>;
  recentWebhooks: Array<{
    id: string;
    eventType: string;
    deliveryStatus: string;
    receivedAt: Date;
    processedAt: Date | null;
  }>;
  errorCountLast24h: number;
}
