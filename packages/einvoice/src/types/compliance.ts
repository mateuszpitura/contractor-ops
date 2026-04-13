// ---------------------------------------------------------------------------
// Compliance Status Types
// ---------------------------------------------------------------------------

/**
 * Canonical compliance state tokens (camelCase).
 * Per D-09: states based on actual provider lifecycle needs.
 */
export const complianceState = {
  /** No profile configured for this org */
  notConnected: 'notConnected',
  onboarding: 'onboarding',
  sandbox: 'sandbox',
  active: 'active',
  degraded: 'degraded',
  suspended: 'suspended',
  error: 'error',
} as const;

export type ComplianceState = (typeof complianceState)[keyof typeof complianceState];

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
