/**
 * Phase 77 D-04 — GoogleWorkspaceAdapter.describeImpact (live + cache-fronted reads).
 * LOCAL-ONLY: MSW handlers, never live sandboxes.
 */

import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GoogleWorkspaceAdapter } from '../google-workspace-adapter.js';

const { server } = createMockServer({ handlersOnly: true });
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ADMIN_HOST = 'admin.googleapis.com';
const isUserPath = (url: string) => {
  const u = new URL(url);
  return u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+$/.test(u.pathname);
};
const isTokensListPath = (url: string) => {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+\/tokens$/.test(u.pathname)
  );
};

const adapter = () => new GoogleWorkspaceAdapter().withAccessToken('fake-token');
const USER = 'jane@company.com';

describe('GoogleWorkspaceAdapter.describeImpact (Phase 77 D-04)', () => {
  it('returns a GOOGLE_WORKSPACE preview with oauthGrants + null sessionCount', async () => {
    server.use(
      http.get(
        ({ request }) => isUserPath(request.url),
        () =>
          HttpResponse.json({ suspended: false, isAdmin: true, name: { fullName: 'Jane Smith' } }),
      ),
      http.get(
        ({ request }) => isTokensListPath(request.url),
        () =>
          HttpResponse.json({
            items: [{ displayText: 'Some App', scopes: ['https://www.googleapis.com/auth/drive'] }],
          }),
      ),
    );
    const preview = await adapter().describeImpact(USER);
    expect(preview.provider).toBe('GOOGLE_WORKSPACE');
    expect(preview.commonMetrics.accountStatus).toBe('ACTIVE');
    expect(preview.commonMetrics.externalUserDisplayName).toBe('Jane Smith');
    expect(preview.commonMetrics.sessionCount).toBeNull();
    if (preview.provider === 'GOOGLE_WORKSPACE') {
      expect(preview.customMetrics.isSuperAdmin).toBe(true);
      expect(preview.customMetrics.oauthGrants).toEqual([
        { appName: 'Some App', scopes: ['https://www.googleapis.com/auth/drive'] },
      ]);
    }
    expect(preview.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('NOT_FOUND user → accountStatus NOT_FOUND with empty grants', async () => {
    server.use(
      http.get(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('gone', { status: 404 }),
      ),
    );
    const preview = await adapter().describeImpact(USER);
    expect(preview.commonMetrics.accountStatus).toBe('NOT_FOUND');
    if (preview.provider === 'GOOGLE_WORKSPACE') {
      expect(preview.customMetrics.oauthGrants).toEqual([]);
    }
  });

  it('SUSPENDED user → accountStatus SUSPENDED', async () => {
    server.use(
      http.get(
        ({ request }) => isUserPath(request.url),
        () => HttpResponse.json({ suspended: true, isAdmin: false, name: { fullName: 'Jane' } }),
      ),
      http.get(
        ({ request }) => isTokensListPath(request.url),
        () => HttpResponse.json({ items: [] }),
      ),
    );
    const preview = await adapter().describeImpact(USER);
    expect(preview.commonMetrics.accountStatus).toBe('SUSPENDED');
  });
});
