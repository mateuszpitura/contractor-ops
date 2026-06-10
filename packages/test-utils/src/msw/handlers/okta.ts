import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions } from '../utils.js';

// Okta lifecycle deprovision handlers.
//
// The `@okta/okta-sdk-nodejs` client targets a tenant-specific host
// (`https://{org}.okta.com`), so handlers match by pathname predicate across
// any host (the SDK base URL is configured per connection). URL predicates are
// used instead of `:id` path literals (MSW v2 + path-to-regexp v8 limitation).

// Matches POST .../api/v1/users/{id}/lifecycle/deactivate
function isOktaDeactivatePath(url: string): boolean {
  return /\/api\/v1\/users\/[^/]+\/lifecycle\/deactivate$/.test(new URL(url).pathname);
}
function isOktaSessionsPath(url: string): boolean {
  return /\/api\/v1\/users\/[^/]+\/sessions$/.test(new URL(url).pathname);
}
function isOktaUserPath(url: string): boolean {
  return /\/api\/v1\/users\/[^/]+$/.test(new URL(url).pathname);
}

export function oktaHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- suspendAccount → deactivateUser (→ DEPROVISIONED) ---
    http.post(
      ({ request }) => isOktaDeactivatePath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({ status: 'DEPROVISIONED' });
      },
    ),

    // --- revokeAllSessions → revokeUserSessions ---
    http.delete(
      ({ request }) => isOktaSessionsPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),

    // --- verifyDeprovisioned / describeImpact → getUser ---
    http.get(
      ({ request }) => isOktaUserPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({ id: 'okta-user-001', status: 'ACTIVE' });
      },
    ),
  ];
}
