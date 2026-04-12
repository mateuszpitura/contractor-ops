// ---------------------------------------------------------------------------
// ZATCA Compliance Status
// ---------------------------------------------------------------------------

import type { ComplianceState, ComplianceStatus } from '../../types/compliance.js';

/**
 * Data needed to compute ZATCA compliance status.
 * Fetched from IntegrationConnection + ZatcaInvoiceChain by the API layer.
 */
export interface ZatcaConnectionData {
  status: string;
  certificateExpiresAt?: Date;
  clearanceCount?: number;
  reportingCount?: number;
  failedCount?: number;
  lastSyncAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
}

/**
 * Compute compliance status for a ZATCA connection.
 * Pure function -- no database access. Data is provided by the caller.
 *
 * States:
 * - not_connected: No ZATCA integration configured
 * - onboarding: Device onboarding in progress
 * - active: Production certificate active, submitting invoices
 * - suspended: Certificate expired or manually paused
 * - error: Failed state requiring intervention
 */
export function computeZatcaComplianceStatus(data: ZatcaConnectionData | null): ComplianceStatus {
  if (!data) {
    return {
      profileId: 'zatca',
      state: 'not_connected',
      country: 'SA',
      displayName: 'ZATCA (Saudi Arabia)',
      healthScore: 0,
      capabilities: {
        canGenerate: true,
        canParse: true,
        canSign: true,
        canQRCode: true,
      },
    };
  }

  const stateMap: Record<string, ComplianceState> = {
    PENDING_MAPPING: 'onboarding',
    CONNECTED: 'active',
    DISCONNECTED: 'suspended',
    ERROR: 'error',
    REAUTH_REQUIRED: 'error',
  };

  let state = stateMap[data.status] ?? 'error';

  // Check for certificate expiry
  if (state === 'active' && data.certificateExpiresAt && data.certificateExpiresAt < new Date()) {
    state = 'suspended';
  }

  // Health score based on submission success rate
  const total = (data.clearanceCount ?? 0) + (data.reportingCount ?? 0) + (data.failedCount ?? 0);
  const successful = (data.clearanceCount ?? 0) + (data.reportingCount ?? 0);
  const healthScore =
    total > 0 ? Math.round((successful / total) * 100) : state === 'active' ? 100 : 0;

  return {
    profileId: 'zatca',
    state,
    country: 'SA',
    displayName: 'ZATCA (Saudi Arabia)',
    lastSyncAt: data.lastSyncAt,
    lastErrorAt: data.lastErrorAt,
    lastErrorMessage: data.lastErrorMessage,
    healthScore,
    capabilities: {
      canGenerate: true,
      canParse: true,
      canSign: true,
      canQRCode: true,
    },
  };
}
