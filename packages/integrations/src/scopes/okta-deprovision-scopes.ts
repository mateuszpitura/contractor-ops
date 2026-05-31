// Phase 78 D-14 — Okta minimum-privilege deprovision scopes.
//
// Mirrors the Phase 76 D-14 typed-const scope-registry pattern. A single OAuth2
// scope (`okta.users.manage`) grants the lifecycle operations the OktaAdapter
// needs: `userApi.deactivateUser` (→ DEPROVISIONED), `userApi.revokeUserSessions`,
// and `userApi.getUser` for the verify/describe-impact reads.

export const OKTA_DEPROVISION_SCOPES = ['okta.users.manage'] as const;

export type OktaDeprovisionScope = (typeof OKTA_DEPROVISION_SCOPES)[number];

export const OKTA_DEPROVISION_CAPABILITIES = ['user.deprovision'] as const;

export type OktaDeprovisionCapability = (typeof OKTA_DEPROVISION_CAPABILITIES)[number];
