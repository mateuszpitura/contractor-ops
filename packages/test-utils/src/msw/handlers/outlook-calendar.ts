import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId } from "../utils.js";

export function outlookCalendarHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post("https://login.microsoftonline.com/common/oauth2/v2.0/token", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `outlook_mock_${mockId()}`,
        refresh_token: `outlook_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: "Bearer",
        scope: "Calendars.ReadWrite",
      });
    }),

    // --- Create Event ---
    http.post("https://graph.microsoft.com/v1.0/me/calendar/events", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: mockId(),
        webLink: `https://outlook.office365.com/owa/?itemid=${mockId()}`,
        subject: "Mock Calendar Event",
        createdDateTime: new Date().toISOString(),
        lastModifiedDateTime: new Date().toISOString(),
      });
    }),

    // --- Update Event ---
    http.patch(
      "https://graph.microsoft.com/v1.0/me/calendar/events/:eventId",
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: params.eventId,
          webLink: `https://outlook.office365.com/owa/?itemid=${params.eventId}`,
          lastModifiedDateTime: new Date().toISOString(),
        });
      },
    ),

    // --- Delete Event ---
    http.delete("https://graph.microsoft.com/v1.0/me/calendar/events/:eventId", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return new HttpResponse(null, { status: 204 });
    }),

    // --- Get Event ---
    http.get("https://graph.microsoft.com/v1.0/me/calendar/events/:eventId", async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.eventId,
        subject: "Mock Calendar Event",
        start: { dateTime: new Date().toISOString(), timeZone: "UTC" },
        end: {
          dateTime: new Date(Date.now() + 3600000).toISOString(),
          timeZone: "UTC",
        },
        webLink: `https://outlook.office365.com/owa/?itemid=${params.eventId}`,
      });
    }),
  ];
}
