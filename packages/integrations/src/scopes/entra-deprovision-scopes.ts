// Microsoft Entra ID minimum-privilege deprovision scopes.
//
// Mirrors the typed-const scope-registry pattern
// (`google-workspace-deprovision-scopes.ts`): the `lint:scopes` CI guard treats
// this constant as the single source of truth for the EntraIdAdapter's
// `getOAuthConfig().scopes`, rejecting any scope literal added directly to the
// adapter without going through this file.
//
// The four application permissions cover:
//   - `User.ReadWrite.All`    → account disable (`accountEnabled:false`) + session revoke
//   - `Directory.Read.All`    → hybrid-AD (`onPremisesSyncEnabled`) + group/license reads
//   - `Policy.Read.All`       → Conditional Access policy enumeration (pre-flight gate)
//   - `AuditLog.Read.All`     → `signInActivity` post-revoke verify

export const ENTRA_DEPROVISION_SCOPES = [
  'https://graph.microsoft.com/User.ReadWrite.All',
  'https://graph.microsoft.com/Directory.Read.All',
  'https://graph.microsoft.com/Policy.Read.All',
  'https://graph.microsoft.com/AuditLog.Read.All',
] as const;

export type EntraDeprovisionScope = (typeof ENTRA_DEPROVISION_SCOPES)[number];

export const ENTRA_DEPROVISION_CAPABILITIES = ['user.deprovision', 'directory.user.write'] as const;

export type EntraDeprovisionCapability = (typeof ENTRA_DEPROVISION_CAPABILITIES)[number];
