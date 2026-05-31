import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions } from '../utils.js';

// Phase 78 IDP-07 — GitHub org deprovision handlers (api.github.com).
//
// `@octokit/rest` targets `api.github.com`. URL predicates are used instead of
// `:org`/`:username` path literals (MSW v2 + path-to-regexp v8 limitation). The
// default member GET returns 404 (not-a-member) so verifyDeprovisioned reads
// LIKELY_GONE; tests override per-case via `server.use(...)`.

const GH_HOST = 'api.github.com';

function isOrgMemberPath(url: string): boolean {
  const u = new URL(url);
  return u.hostname === GH_HOST && /^\/orgs\/[^/]+\/members\/[^/]+$/.test(u.pathname);
}
function isOutsideCollaboratorsPath(url: string): boolean {
  const u = new URL(url);
  return u.hostname === GH_HOST && /^\/orgs\/[^/]+\/outside_collaborators$/.test(u.pathname);
}
function isCredentialAuthorizationsPath(url: string): boolean {
  const u = new URL(url);
  return u.hostname === GH_HOST && /^\/orgs\/[^/]+\/credential-authorizations$/.test(u.pathname);
}
function isCredentialAuthorizationDeletePath(url: string): boolean {
  const u = new URL(url);
  return (
    u.hostname === GH_HOST && /^\/orgs\/[^/]+\/credential-authorizations\/[^/]+$/.test(u.pathname)
  );
}

export function githubHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- suspendAccount → removeMember (DELETE /orgs/{org}/members/{username}) ---
    http.delete(
      ({ request }) => isOrgMemberPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),

    // --- verifyDeprovisioned → checkMembershipForUser (404 = not a member = LIKELY_GONE) ---
    http.get(
      ({ request }) => isOrgMemberPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 404 });
      },
    ),

    // --- describeImpact → outside collaborators (default empty; overridable) ---
    http.get(
      ({ request }) => isOutsideCollaboratorsPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json([]);
      },
    ),

    // --- revokeAllSessions → list per-PAT credential-authorizations (SAML SSO org) ---
    http.get(
      ({ request }) => isCredentialAuthorizationsPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json([
          {
            login: 'octocat',
            credential_id: 1001,
            credential_type: 'personal access token',
            token_last_eight: 'abcd1234',
            scopes: ['repo', 'read:org'],
          },
        ]);
      },
    ),

    // --- revokeAllSessions → revoke a single credential-authorization ---
    http.delete(
      ({ request }) => isCredentialAuthorizationDeletePath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),
  ];
}
