import { HttpResponse, http } from "msw";
import type { HandlerOptions } from "../types.js";
import { applyNetworkConditions, mockId } from "../utils.js";

export function googleCalendarHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post("https://oauth2.googleapis.com/token", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `google_mock_${mockId()}`,
        refresh_token: `google_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/calendar.events",
      });
    }),

    // --- Create Event ---
    http.post("https://www.googleapis.com/calendar/v3/calendars/:calendarId/events", async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      const eventId = mockId().replace(/-/g, "");
      return HttpResponse.json({
        id: eventId,
        htmlLink: `https://www.google.com/calendar/event?eid=${eventId}`,
        etag: `"${mockId().slice(0, 8)}"`,
        status: "confirmed",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      });
    }),

    // --- Update Event ---
    http.patch(
      "https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId",
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: params.eventId,
          htmlLink: `https://www.google.com/calendar/event?eid=${params.eventId}`,
          etag: `"${mockId().slice(0, 8)}"`,
          status: "confirmed",
          updated: new Date().toISOString(),
        });
      },
    ),

    // --- Delete Event ---
    http.delete(
      "https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId",
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),

    // --- Get Event ---
    http.get(
      "https://www.googleapis.com/calendar/v3/calendars/:calendarId/events/:eventId",
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: params.eventId,
          summary: "Mock Calendar Event",
          start: { dateTime: new Date().toISOString(), timeZone: "UTC" },
          end: {
            dateTime: new Date(Date.now() + 3600000).toISOString(),
            timeZone: "UTC",
          },
          etag: `"${mockId().slice(0, 8)}"`,
          status: "confirmed",
        });
      },
    ),
  ];
}
