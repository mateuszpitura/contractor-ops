// Phase 77 D-14 — Slack org-grid minimum-privilege deprovision scopes.
//
// Single source of truth: the `lint:scopes` CI guard (Phase 76 D-15) verifies
// that the SlackAdapter's `getOAuthConfig().scopes` array (for the
// SLACK_ORG_GRID connection) contains every scope listed here, and rejects any
// scope literal added directly to the adapter without going through this
// constant. Mirrors the GWS scope-const sibling.
//
//   admin.users.session:write — invalidate all sessions for a user (org-wide).
//   scim:write                — deactivate the user via the SCIM API (Enterprise Grid).

export const SLACK_DEPROVISION_SCOPES = ['admin.users.session:write', 'scim:write'] as const;

export type SlackDeprovisionScope = (typeof SLACK_DEPROVISION_SCOPES)[number];
