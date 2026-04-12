import { HttpResponse, http } from "msw";
import { mockId } from "../utils.js";

/**
 * Handlers simulating expired OAuth tokens.
 * First API call returns 401, subsequent calls succeed (simulating token refresh).
 * Tests that our system handles token refresh gracefully.
 */
export function tokenExpiredHandlers() {
  const refreshed = new Set<string>();

  return [
    // --- Jira: 401 then success ---
    http.get(
      "https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey",
      ({ params }) => {
        const key = `jira-${params.cloudId}`;
        if (!refreshed.has(key)) {
          refreshed.add(key);
          return HttpResponse.json(
            { message: "Token expired", code: 401 },
            { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
          );
        }
        return HttpResponse.json({
          id: mockId(),
          key: params.issueKey,
          fields: {
            summary: "Got it after token refresh",
            status: { id: "1", name: "To Do", statusCategory: { key: "new" } },
            assignee: null,
            issuetype: { id: "10001", name: "Task" },
            project: { id: "10000", key: "TEST", name: "Test" },
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        });
      },
    ),

    // Token refresh should still work
    http.post("https://auth.atlassian.com/oauth/token", () => {
      return HttpResponse.json({
        access_token: `refreshed_atlassian_${mockId()}`,
        refresh_token: `new_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: "Bearer",
      });
    }),

    // --- Linear: 401 ---
    http.post("https://api.linear.app/graphql", () => {
      const key = "linear";
      if (!refreshed.has(key)) {
        refreshed.add(key);
        return HttpResponse.json(
          {
            errors: [
              { message: "Authentication required", extensions: { code: "UNAUTHENTICATED" } },
            ],
          },
          { status: 401 },
        );
      }
      return HttpResponse.json({ data: {} });
    }),

    http.post("https://api.linear.app/oauth/token", () => {
      return HttpResponse.json({
        access_token: `refreshed_linear_${mockId()}`,
        refresh_token: `new_refresh_${mockId()}`,
        expires_in: 315360000,
        token_type: "Bearer",
      });
    }),

    // --- Google Calendar: 401 ---
    http.post("https://www.googleapis.com/calendar/v3/calendars/:calendarId/events", () => {
      const key = "google-calendar";
      if (!refreshed.has(key)) {
        refreshed.add(key);
        return HttpResponse.json(
          {
            error: {
              code: 401,
              message: "Invalid Credentials",
              errors: [{ domain: "global", reason: "authError" }],
            },
          },
          { status: 401 },
        );
      }
      return HttpResponse.json({ id: "event-after-refresh", status: "confirmed" });
    }),

    http.post("https://oauth2.googleapis.com/token", () => {
      return HttpResponse.json({
        access_token: `refreshed_google_${mockId()}`,
        expires_in: 3600,
        token_type: "Bearer",
      });
    }),

    // --- Outlook Calendar: 401 ---
    http.post("https://graph.microsoft.com/v1.0/me/calendar/events", () => {
      const key = "outlook-calendar";
      if (!refreshed.has(key)) {
        refreshed.add(key);
        return HttpResponse.json(
          {
            error: {
              code: "InvalidAuthenticationToken",
              message: "Access token has expired or is not yet valid.",
            },
          },
          { status: 401 },
        );
      }
      return HttpResponse.json({ id: "event-after-refresh" });
    }),

    http.post("https://login.microsoftonline.com/common/oauth2/v2.0/token", () => {
      return HttpResponse.json({
        access_token: `refreshed_outlook_${mockId()}`,
        refresh_token: `new_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: "Bearer",
      });
    }),

    // --- DocuSign: 401 ---
    http.post("https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes", () => {
      const key = "docusign";
      if (!refreshed.has(key)) {
        refreshed.add(key);
        return HttpResponse.json(
          { errorCode: "USER_AUTHENTICATION_FAILED", message: "Token expired." },
          { status: 401 },
        );
      }
      return HttpResponse.json({ envelopeId: mockId(), status: "sent" });
    }),

    http.post("https://account-d.docusign.com/oauth/token", () => {
      return HttpResponse.json({
        access_token: `refreshed_docusign_${mockId()}`,
        refresh_token: `new_refresh_${mockId()}`,
        expires_in: 28800,
        token_type: "Bearer",
      });
    }),
  ];
}
