import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function googleWorkspaceHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange (shared with Google Calendar but may be used standalone) ---
    http.post('https://oauth2.googleapis.com/token', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `google_ws_mock_${mockId()}`,
        refresh_token: `google_ws_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: 'Bearer',
        scope:
          'https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.group.readonly',
      });
    }),

    // --- List Directory Users ---
    http.get('https://admin.googleapis.com/admin/directory/v1/users', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        users: [
          {
            id: 'user-gw-001',
            primaryEmail: 'john@company.com',
            name: {
              givenName: 'John',
              familyName: 'Doe',
              fullName: 'John Doe',
            },
            thumbnailPhotoUrl: 'https://lh3.googleusercontent.com/photo.jpg',
            orgUnitPath: '/Engineering',
            organizations: [
              {
                department: 'Engineering',
                title: 'Software Developer',
                primary: true,
              },
            ],
            suspended: false,
            isAdmin: false,
          },
          {
            id: 'user-gw-002',
            primaryEmail: 'jane@company.com',
            name: {
              givenName: 'Jane',
              familyName: 'Smith',
              fullName: 'Jane Smith',
            },
            thumbnailPhotoUrl: null,
            orgUnitPath: '/Engineering',
            organizations: [
              {
                department: 'Engineering',
                title: 'Tech Lead',
                primary: true,
              },
            ],
            suspended: false,
            isAdmin: true,
          },
        ],
        // No nextPageToken = last page
      });
    }),

    // --- List User Groups ---
    http.get('https://admin.googleapis.com/admin/directory/v1/groups', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        groups: [
          {
            id: 'group-001',
            email: 'engineering@company.com',
            name: 'Engineering',
            description: 'Engineering team',
            directMembersCount: '15',
          },
          {
            id: 'group-002',
            email: 'contractors@company.com',
            name: 'Contractors',
            description: 'External contractors',
            directMembersCount: '5',
          },
        ],
      });
    }),

    // --- Deprovisioning endpoints ---
    // Path predicates (MSW v2 + path-to-regexp v8 rejects glob/regex path literals).
    // Suspend (PATCH user).
    http.patch(
      ({ request }) => isAdminUserPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({ suspended: true });
      },
    ),
    // describeImpact / verify (GET user).
    http.get(
      ({ request }) => isAdminUserPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          suspended: false,
          isAdmin: false,
          name: { fullName: 'Mock User' },
        });
      },
    ),
    // tokens.list
    http.get(
      ({ request }) => isAdminTokensListPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          items: [{ clientId: `app-${mockId()}`, displayText: 'Mock App', scopes: ['openid'] }],
        });
      },
    ),
    // tokens.delete
    http.delete(
      ({ request }) => isAdminTokenDeletePath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),
    // users.signOut
    http.post(
      ({ request }) => isAdminSignOutPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),
    // drives.list (describeImpact best-effort)
    http.get('https://www.googleapis.com/drive/v3/drives', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({ drives: [] });
    }),
  ];
}

const ADMIN_HOST = 'admin.googleapis.com';
function isAdminUserPath(url: string): boolean {
  const u = new URL(url);
  return u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+$/.test(u.pathname);
}
function isAdminTokensListPath(url: string): boolean {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+\/tokens$/.test(u.pathname)
  );
}
function isAdminTokenDeletePath(url: string): boolean {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST &&
    /^\/admin\/directory\/v1\/users\/[^/]+\/tokens\/[^/]+$/.test(u.pathname)
  );
}
function isAdminSignOutPath(url: string): boolean {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+\/signOut$/.test(u.pathname)
  );
}
