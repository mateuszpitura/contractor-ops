import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function slackHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post('https://slack.com/api/oauth.v2.access', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        access_token: `xoxb-mock-${mockId()}`,
        token_type: 'bot',
        scope: 'chat:write,users:read,users:read.email',
        bot_user_id: 'U_MOCK_BOT',
        app_id: 'A_MOCK_APP',
        team: { id: 'T_MOCK_TEAM', name: 'Test Workspace' },
        authed_user: { id: 'U_MOCK_USER' },
      });
    }),

    // --- Post Message ---
    http.post('https://slack.com/api/chat.postMessage', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        channel: 'C_MOCK_CHANNEL',
        ts: `${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 999999)
          .toString()
          .padStart(6, '0')}`,
        message: {
          type: 'message',
          subtype: 'bot_message',
          text: 'Mock message',
        },
      });
    }),

    // --- Update Message ---
    http.post('https://slack.com/api/chat.update', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        channel: 'C_MOCK_CHANNEL',
        ts: `${Math.floor(Date.now() / 1000)}.000001`,
      });
    }),

    // --- Users List ---
    http.post('https://slack.com/api/users.list', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        members: [
          {
            id: 'U_USER_001',
            name: 'testuser',
            deleted: false,
            is_bot: false,
            profile: {
              email: 'test@example.com',
              real_name: 'Test User',
              display_name: 'testuser',
              image_48: 'https://placeholders.dev/48x48',
            },
          },
          {
            id: 'U_USER_002',
            name: 'contractor',
            deleted: false,
            is_bot: false,
            profile: {
              email: 'contractor@example.com',
              real_name: 'Test Contractor',
              display_name: 'contractor',
              image_48: 'https://placeholders.dev/48x48',
            },
          },
        ],
        response_metadata: { next_cursor: '' },
      });
    }),

    // NOTE: conversations.open, views.open, views.update are NOT used
    // in production code. Add handlers here only when production starts
    // calling these Slack API methods.

    // --- Phase 77 D-05/D-08/D-14 deprovisioning (SCIM + admin.session + users.*) ---
    // SCIM lookup by filter.
    http.get('https://api.slack.com/scim/v2/Users', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        Resources: [{ id: `W${mockId().slice(0, 8)}`, userName: 'contractor@example.com' }],
      });
    }),
    // SCIM PATCH (deactivate) — path predicate covers /scim/v2/Users/{id}.
    http.patch(
      ({ request }) => isScimUserPath(request.url),
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({ id: 'W_MOCK', active: false });
      },
    ),
    // admin.users.session.invalidate.
    http.post('https://slack.com/api/admin.users.session.invalidate', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({ ok: true });
    }),
    // users.info.
    http.post('https://slack.com/api/users.info', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        user: {
          id: 'U_USER_002',
          deleted: false,
          is_admin: false,
          is_owner: false,
          profile: { real_name: 'Test Contractor', display_name: 'contractor' },
        },
      });
    }),
    // users.lookupByEmail.
    http.post('https://slack.com/api/users.lookupByEmail', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({ ok: true, user: { id: 'U_USER_002' } });
    }),
    // users.conversations.
    http.post('https://slack.com/api/users.conversations', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        channels: [{ id: 'C1' }, { id: 'C2' }],
        response_metadata: { next_cursor: '' },
      });
    }),
    // apps.permissions.users.list.
    http.post('https://slack.com/api/apps.permissions.users.list', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({ ok: true, apps: [{ id: 'A1' }] });
    }),
  ];
}

function isScimUserPath(url: string): boolean {
  const u = new URL(url);
  return u.hostname === 'api.slack.com' && /^\/scim\/v2\/Users\/[^/]+$/.test(u.pathname);
}
