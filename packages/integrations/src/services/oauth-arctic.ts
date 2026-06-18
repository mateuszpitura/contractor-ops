/**
 * Forward-looking shim for `arctic` (Lucia author). Adopt opportunistically
 * for NEW OAuth providers; do NOT migrate the existing 7+ flows
 * (Slack/Jira/Linear/Notion/Google/Outlook/Confluence/Clockify) — they
 * already work and the layered HMAC + DB-challenge defense from oauth-state.ts
 * + services/oauth-challenge.ts in @contractor-ops/api is sufficient.
 *
 * Why arctic at all?
 *   - Pre-typed provider configs save real time when adding e.g. HubSpot,
 *     Zoom, GitHub Apps, etc.
 *   - First-class PKCE + state helpers, runtime-agnostic.
 *   - 75 KB, zero deps. Safe to import on Node + Edge.
 *
 * Usage sketch (do NOT remove — example for the next provider integration):
 *
 *   import { Slack } from 'arctic';
 *   import { generateState } from 'arctic';
 *
 *   const slack = new Slack(env.SLACK_CLIENT_ID, env.SLACK_CLIENT_SECRET, redirectUri);
 *   const state = generateState();
 *   // Layer the OAuthChallenge insert + __Host-oauth_state cookie ON TOP of
 *   // arctic's `state` for CSRF protection.
 *   const url = slack.createAuthorizationURL(state, ['users:read']);
 *
 *   // On callback:
 *   const tokens = await slack.validateAuthorizationCode(code);
 *
 * arctic ships ~50 provider classes; pick the matching one when adding a
 * new integration. See https://arcticjs.dev/ for the catalogue.
 */

// Re-export `generateState` so call sites pick up the same arctic version
// that's pinned at the workspace root, without adding `arctic` as a direct
// dep on every package that needs OAuth.
// biome-ignore lint/performance/noBarrelFile: not a barrel — arctic shim module; single re-export to share the root-pinned arctic version
export { generateCodeVerifier, generateState } from 'arctic';

/**
 * Smoke-test helper used by the Phase-2 verification. Imports a single arctic
 * class to confirm the dep resolves cleanly at typecheck time. Real adapter
 * code should import the specific provider class it needs (e.g. `Slack`,
 * `Hubspot`, `Zoom`, `GitHub`).
 */
export type ArcticOAuthProviderToken = string & { readonly __arcticToken: unique symbol };
