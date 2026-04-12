// ---------------------------------------------------------------------------
// Compliance Status Types
// ---------------------------------------------------------------------------

/**
 * Lifecycle state of an e-invoicing country profile for an organization.
 * Per D-09: states based on actual provider lifecycle needs.
 */
export type ComplianceState =
  | 'not_connected' // No profile configured for this org
  | 'onboarding' // Setup in progress (e.g., ZATCA CSID exchange)
  | 'sandbox' // Connected to test environment
  | 'active' // Connected and syncing successfully
  | 'degraded' // Connected but recent errors (still operational)
  | 'suspended' // Manually paused or credential expired
  | 'error'; // Failed — requires intervention

/**
 * Capability flags for a profile.
 */
export interface ComplianceCapabilities {
  canGenerate: boolean;
  canParse: boolean;
  canSign: boolean;
  canQRCode: boolean;
}

/**
 * Compliance status snapshot for one e-invoicing profile within an organization.
 */
export interface ComplianceStatus {
  profileId: string;
  state: ComplianceState;
  /** ISO 3166-1 alpha-2 country code */
  country: string;
  displayName: string;
  lastSyncAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
  /** 0-100 based on recent sync success rate */
  healthScore: number;
  capabilities: ComplianceCapabilities;
}
