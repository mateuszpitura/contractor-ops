/**
 * Phase 77 D-08/D-16 — Enterprise-Grid pre-flight detection (the adapter half).
 * `cannot_perform_operation` is the canonical not-on-Grid signal:
 *  - on a deprovision call → PERMANENT_FORBIDDEN (never silently no-ops)
 *  - on describeImpact → non-fatal customMetrics.error = 'NOT_ON_ENTERPRISE_GRID'
 * LOCAL-ONLY: MSW handlers.
 */

import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SlackAdapter } from '../slack-adapter.js';

const { server } = createMockServer({ handlersOnly: true });
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const isScimUserPath = (url: string) => {
  const u = new URL(url);
  return u.hostname === 'api.slack.com' && /^\/scim\/v2\/Users\/[^/]+$/.test(u.pathname);
};

const adapter = () => new SlackAdapter().withOrgGridToken('org-grid-token');
const USER_ID = 'W08001';

describe('Slack Enterprise-Grid detection (Phase 77 D-08/D-16)', () => {
  it('SCIM cannot_perform_operation on a deprovision call → PERMANENT_FORBIDDEN', async () => {
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        () => HttpResponse.json({ scimType: 'cannot_perform_operation' }, { status: 403 }),
      ),
    );
    const result = await adapter().suspendAccount(USER_ID);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
  });

  it('describeImpact on a non-Grid org → NOT_ON_ENTERPRISE_GRID, non-fatal', async () => {
    server.use(
      http.post('https://slack.com/api/users.info', () =>
        HttpResponse.json({ ok: false, error: 'cannot_perform_operation' }),
      ),
    );
    const preview = await adapter().describeImpact(USER_ID);
    expect(preview.provider).toBe('SLACK');
    expect(preview.commonMetrics.accountStatus).toBe('NOT_FOUND');
    if (preview.provider === 'SLACK') {
      expect(preview.customMetrics.error).toBe('NOT_ON_ENTERPRISE_GRID');
      expect(preview.customMetrics.channelsMemberCount).toBeNull();
      expect(preview.customMetrics.installedAppCount).toBeNull();
    }
  });

  it('org-grid OAuth config requests both deprovision scopes with the org-grid redirect', () => {
    const cfg = new SlackAdapter().getOrgGridOAuthConfig();
    expect(cfg.scopes).toEqual(['admin.users.session:write', 'scim:write']);
    expect(cfg.redirectPath).toBe('/api/oauth/slack-org-grid/callback');
    expect(cfg.connectionSubKind).toBe('SLACK_ORG_GRID');
  });

  it('workspace getOAuthConfig stays unchanged (no deprovision scopes)', () => {
    const cfg = new SlackAdapter().getOAuthConfig();
    expect(cfg.scopes).toEqual(['chat:write', 'users:read', 'users:read.email', 'im:write']);
    expect(cfg.redirectPath).toBe('/api/oauth/slack/callback');
    expect(cfg.connectionSubKind).toBeUndefined();
  });
});
