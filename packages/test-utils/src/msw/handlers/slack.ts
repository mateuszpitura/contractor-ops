import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId } from "../utils.js";

export function slackHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post("https://slack.com/api/oauth.v2.access", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        access_token: `xoxb-mock-${mockId()}`,
        token_type: "bot",
        scope: "chat:write,users:read,users:read.email",
        bot_user_id: "U_MOCK_BOT",
        app_id: "A_MOCK_APP",
        team: { id: "T_MOCK_TEAM", name: "Test Workspace" },
        authed_user: { id: "U_MOCK_USER" },
      });
    }),

    // --- Post Message ---
    http.post("https://slack.com/api/chat.postMessage", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        channel: "C_MOCK_CHANNEL",
        ts: `${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 999999)
          .toString()
          .padStart(6, "0")}`,
        message: {
          type: "message",
          subtype: "bot_message",
          text: "Mock message",
        },
      });
    }),

    // --- Update Message ---
    http.post("https://slack.com/api/chat.update", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        channel: "C_MOCK_CHANNEL",
        ts: `${Math.floor(Date.now() / 1000)}.000001`,
      });
    }),

    // --- Users List ---
    http.post("https://slack.com/api/users.list", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        ok: true,
        members: [
          {
            id: "U_USER_001",
            name: "testuser",
            deleted: false,
            is_bot: false,
            profile: {
              email: "test@example.com",
              real_name: "Test User",
              display_name: "testuser",
              image_48: "https://placeholders.dev/48x48",
            },
          },
          {
            id: "U_USER_002",
            name: "contractor",
            deleted: false,
            is_bot: false,
            profile: {
              email: "contractor@example.com",
              real_name: "Test Contractor",
              display_name: "contractor",
              image_48: "https://placeholders.dev/48x48",
            },
          },
        ],
        response_metadata: { next_cursor: "" },
      });
    }),

    // NOTE: conversations.open, views.open, views.update are NOT used
    // in production code. Add handlers here only when production starts
    // calling these Slack API methods.
  ];
}
