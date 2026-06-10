/**
 * SlackAdapter.describeImpact tests (best-effort reads).
 * LOCAL-ONLY: MSW handlers.
 */

import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SlackAdapter } from '../slack-adapter.js';

const { server } = createMockServer({ handlersOnly: true });
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const adapter = () => new SlackAdapter().withOrgGridToken('org-grid-token');
const USER_ID = 'W08001';

describe('SlackAdapter.describeImpact', () => {
  it('returns a SLACK preview with admin/owner booleans + capped channel count', async () => {
    server.use(
      http.post('https://slack.com/api/users.info', () =>
        HttpResponse.json({
          ok: true,
          user: {
            deleted: false,
            is_admin: true,
            is_owner: false,
            profile: { real_name: 'Jane Slack' },
          },
        }),
      ),
      http.post('https://slack.com/api/users.conversations', () =>
        HttpResponse.json({ ok: true, channels: [{ id: 'C1' }, { id: 'C2' }, { id: 'C3' }] }),
      ),
      http.post('https://slack.com/api/apps.permissions.users.list', () =>
        HttpResponse.json({ ok: true, apps: [{ id: 'A1' }, { id: 'A2' }] }),
      ),
    );
    const preview = await adapter().describeImpact(USER_ID);
    expect(preview.provider).toBe('SLACK');
    expect(preview.commonMetrics.accountStatus).toBe('ACTIVE');
    expect(preview.commonMetrics.externalUserDisplayName).toBe('Jane Slack');
    if (preview.provider === 'SLACK') {
      expect(preview.customMetrics.isWorkspaceAdmin).toBe(true);
      expect(preview.customMetrics.isOrgOwner).toBe(false);
      expect(preview.customMetrics.channelsMemberCount).toBe(3);
      expect(preview.customMetrics.installedAppCount).toBe(2);
      expect(preview.customMetrics.error).toBeNull();
    }
  });

  it('degrades installedAppCount to null when apps method unavailable', async () => {
    server.use(
      http.post('https://slack.com/api/users.info', () =>
        HttpResponse.json({ ok: true, user: { deleted: false } }),
      ),
      http.post('https://slack.com/api/users.conversations', () =>
        HttpResponse.json({ ok: true, channels: [] }),
      ),
      http.post('https://slack.com/api/apps.permissions.users.list', () =>
        HttpResponse.json({ ok: false, error: 'method_not_supported_for_channel_type' }),
      ),
    );
    const preview = await adapter().describeImpact(USER_ID);
    if (preview.provider === 'SLACK') {
      expect(preview.customMetrics.installedAppCount).toBeNull();
      expect(preview.customMetrics.channelsMemberCount).toBe(0);
    }
  });

  it('deleted user → accountStatus SUSPENDED', async () => {
    server.use(
      http.post('https://slack.com/api/users.info', () =>
        HttpResponse.json({ ok: true, user: { deleted: true } }),
      ),
      http.post('https://slack.com/api/users.conversations', () =>
        HttpResponse.json({ ok: true, channels: [] }),
      ),
      http.post('https://slack.com/api/apps.permissions.users.list', () =>
        HttpResponse.json({ ok: true, apps: [] }),
      ),
    );
    const preview = await adapter().describeImpact(USER_ID);
    expect(preview.commonMetrics.accountStatus).toBe('SUSPENDED');
  });
});
