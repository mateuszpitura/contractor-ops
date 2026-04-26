// Phase 70 D-13 — TypeScript shape of IntegrationConnection.scopeCapabilities (JSONB).
//
// Code branches on the typed `capabilities` enum, NEVER on raw scope strings.
// Raw scopes are preserved for audit fidelity + Phase 76 drift detection.

export type ProviderId = 'google' | 'slack' | 'entra' | 'okta' | 'github';

export type CapabilityEnum =
  | 'directory.read'
  | 'directory.write'
  | 'user.deprovision'
  | 'user.suspend'
  | 'group.read'
  | 'group.write'
  | 'audit.read';

export interface ScopeCapabilities {
  provider: ProviderId;
  scopes: string[];
  capabilities: CapabilityEnum[];
  grantedAt: string;
}
