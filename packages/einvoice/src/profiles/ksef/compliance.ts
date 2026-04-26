import type { ComplianceState, ComplianceStatus } from '../../types/compliance.js';
import { complianceState } from '../../types/compliance.js';

// ---------------------------------------------------------------------------
// KSeF Compliance Status
// ---------------------------------------------------------------------------

/**
 * Data needed to compute KSeF compliance status.
 * Fetched from IntegrationConnection + IntegrationSyncLog by the API layer.
 */
export interface KsefConnectionData {
  status: string;
  configJson: Record<string, unknown> | null;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  connectedAt: Date;
  recentSyncStatuses: string[];
}

function deriveComplianceState(
  connection: KsefConnectionData,
  config: Record<string, unknown>,
): ComplianceState {
  if (connection.status === 'DISCONNECTED') return 'suspended';
  if (connection.status === 'ERROR' || connection.status === 'REAUTH_REQUIRED') return 'error';
  if (config.environment === 'test') return 'sandbox';

  const hasRecentErrors = connection.recentSyncStatuses.some(s => s === 'FAILED');
  return hasRecentErrors ? 'degraded' : 'active';
}

/**
 * Compute compliance status for a KSeF connection.
 * Pure function — no database access. Data is provided by the caller.
 *
 * Per D-09: compliance states based on actual KSeF lifecycle needs.
 */
export function computeKsefComplianceStatus(
  connection: KsefConnectionData | null,
): ComplianceStatus {
  if (!connection) {
    return {
      profileId: 'ksef',
      state: complianceState.notConnected,
      country: 'PL',
      displayName: 'KSeF (Poland)',
      healthScore: 0,
      capabilities: {
        canGenerate: true,
        canParse: true,
        canSign: false,
        canQRCode: false,
      },
    };
  }

  const config = (connection.configJson ?? {}) as Record<string, unknown>;
  const state = deriveComplianceState(connection, config);

  // Health score: percentage of recent syncs that succeeded
  const successCount = connection.recentSyncStatuses.filter(s => s === 'SUCCESS').length;
  const totalSyncs = connection.recentSyncStatuses.length;
  const healthScore = totalSyncs > 0 ? Math.round((successCount / totalSyncs) * 100) : 0;

  return {
    profileId: 'ksef',
    state,
    country: 'PL',
    displayName: 'KSeF (Poland)',
    lastSyncAt: connection.lastSyncAt ?? undefined,
    lastErrorAt: connection.lastErrorAt ?? undefined,
    lastErrorMessage: connection.lastErrorMessage ?? undefined,
    healthScore,
    capabilities: {
      canGenerate: true,
      canParse: true,
      canSign: false,
      canQRCode: false,
    },
  };
}
