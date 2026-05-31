// Phase 78 D-14 — GitHub org minimum-privilege deprovision scopes.
//
// Mirrors the Phase 76 D-14 typed-const scope-registry pattern. The two classic
// OAuth scopes cover the GitHubAdapter's org-membership operations:
//   - `admin:org` → remove org member (`orgs.removeMember`) + revoke per-PAT
//                   credential-authorizations on a SAML SSO org
//   - `read:org`  → enumerate repos / teams / outside-collaborators / pending
//                   invitations for `describeImpact`
//
// The capability literals describe the org-scoped actions the adapter performs;
// they are deliberately GitHub-specific (org member removal + credential revoke)
// rather than the directory-shaped capabilities of the IdP providers.

export const GITHUB_DEPROVISION_SCOPES = ['admin:org', 'read:org'] as const;

export type GitHubDeprovisionScope = (typeof GITHUB_DEPROVISION_SCOPES)[number];

export const GITHUB_DEPROVISION_CAPABILITIES = [
  'org.member.remove',
  'org.credential.revoke',
] as const;

export type GitHubDeprovisionCapability = (typeof GITHUB_DEPROVISION_CAPABILITIES)[number];
