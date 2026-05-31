import type { CapabilityEnum } from '@contractor-ops/db';

// Phase 76 D-14 — Google Workspace minimum-privilege deprovision scopes.
//
// Single source of truth: the `lint:scopes` CI guard (Plan 76-07) verifies that
// the GoogleWorkspaceAdapter's `getOAuthConfig().scopes` array contains every
// scope listed here, and rejects any scope literal added directly to the adapter
// without going through this constant.
//
// Capability mapping (Phase 70 D-13 ScopeCapabilities JSONB):
//   admin.directory.user grants 'user.deprovision' + 'directory.write'.
// The OAuth callback (Plan 76-08) writes these capabilities into
// IntegrationConnection.scopeCapabilities.capabilities. The capability literals
// MUST be members of the db `CapabilityEnum` (enforced by `satisfies` below).

export const GOOGLE_WORKSPACE_DEPROVISION_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  // Phase 77 D-07 — required for the OAuth-grant revoke (tokens.list/delete) and
  // the sign-out-all-sessions (users.signOut) sub-actions of revokeAllSessions.
  'https://www.googleapis.com/auth/admin.directory.user.security',
] as const;

export type GoogleWorkspaceDeprovisionScope = (typeof GOOGLE_WORKSPACE_DEPROVISION_SCOPES)[number];

export const GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES = [
  'user.deprovision',
  'directory.write',
] as const satisfies readonly CapabilityEnum[];

export type GoogleWorkspaceDeprovisionCapability =
  (typeof GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES)[number];
