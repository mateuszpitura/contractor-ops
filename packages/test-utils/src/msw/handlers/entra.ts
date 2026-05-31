import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions } from '../utils.js';

// Phase 78 IDP-05 — Microsoft Entra ID (Graph API) deprovision handlers.
//
// Mirrors the google-workspace.ts deprovision shape: URL predicates instead of
// `:id` path literals (MSW v2 + path-to-regexp v8 rejects glob/regex path
// literals). Hostname is `graph.microsoft.com`, matching the EntraIdAdapter's
// raw-Graph base URL (same host as the OutlookCalendarAdapter).

const GRAPH_HOST = 'graph.microsoft.com';

function isGraphUserPath(url: string): boolean {
  const u = new URL(url);
  return u.hostname === GRAPH_HOST && /^\/v1\.0\/users\/[^/]+$/.test(u.pathname);
}
function isGraphRevokeSessionsPath(url: string): boolean {
  const u = new URL(url);
  return (
    u.hostname === GRAPH_HOST && /^\/v1\.0\/users\/[^/]+\/revokeSignInSessions$/.test(u.pathname)
  );
}

export function entraHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange (client credentials) ---
    http.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: 'entra_mock_access_token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://graph.microsoft.com/.default',
      });
    }),

    // --- Conditional Access policy enumeration (pre-flight gate) ---
    http.get('https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        value: [
          {
            id: 'ca-policy-001',
            displayName: 'Require MFA for all users',
            state: 'enabled',
            conditions: {
              users: { includeUsers: ['All'] },
            },
            sessionControls: {
              signInFrequency: { isEnabled: true, value: 1, type: 'hours' },
            },
          },
        ],
      });
    }),

    // --- Suspend (PATCH user → accountEnabled:false) ---
    http.patch(
      ({ request }) => isGraphUserPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),

    // --- revokeAllSessions (POST /revokeSignInSessions) ---
    http.post(
      ({ request }) => isGraphRevokeSessionsPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({ value: true });
      },
    ),

    // --- describeImpact / verifyDeprovisioned (GET user, supports $select) ---
    http.get(
      ({ request }) => isGraphUserPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: 'entra-user-001',
          accountEnabled: true,
          onPremisesSyncEnabled: false,
          signInActivity: { lastSignInDateTime: new Date().toISOString() },
        });
      },
    ),
  ];
}
