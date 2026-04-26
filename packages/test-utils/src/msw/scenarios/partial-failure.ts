import { delay, HttpResponse, http } from 'msw';
import { isQStashPublishUrl } from '../handlers/qstash.js';
import { mockId } from '../utils.js';

function isAtlassianJiraApiUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'api.atlassian.com' && u.pathname.startsWith('/ex/jira/');
  } catch {
    return false;
  }
}

/**
 * Handlers simulating partial service failures.
 * Some providers work fine while others are down.
 * Tests that our system degrades gracefully and doesn't let
 * one failing integration break unrelated functionality.
 */
export function partialFailureHandlers() {
  return [
    // ===== WORKING SERVICES =====

    // Stripe works fine
    http.post('https://api.stripe.com/v1/customers', () => {
      return HttpResponse.json({
        id: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
        object: 'customer',
        email: 'test@example.com',
      });
    }),

    // Resend works fine
    http.post('https://api.resend.com/emails', () => {
      return HttpResponse.json({
        id: mockId(),
        from: 'noreply@contractorhub.io',
        to: ['test@example.com'],
      });
    }),

    // QStash works fine
    http.post(
      ({ request }) => isQStashPublishUrl(request.url),
      () => {
        return HttpResponse.json({ messageId: `msg_${mockId()}` });
      },
    ),

    // ===== FAILING SERVICES =====

    // Jira is completely down
    http.all(
      ({ request }) => isAtlassianJiraApiUrl(request.url),
      async () => {
        await delay(500);
        return HttpResponse.json({ message: 'Service is unavailable' }, { status: 503 });
      },
    ),

    // Linear returns errors
    http.post('https://api.linear.app/graphql', () => {
      return HttpResponse.json(
        {
          errors: [
            { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } },
          ],
        },
        { status: 500 },
      );
    }),

    // Slack API errors
    http.post('https://slack.com/api/chat.postMessage', () => {
      return HttpResponse.json({ ok: false, error: 'channel_not_found' });
    }),

    // Google Calendar down
    http.post('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events', () => {
      return HttpResponse.json(
        { error: { code: 503, message: 'The service is currently unavailable.' } },
        { status: 503 },
      );
    }),

    // OAuth token refresh for Jira fails
    http.post('https://auth.atlassian.com/oauth/token', () => {
      return HttpResponse.json(
        { error: 'server_error', error_description: 'Service unavailable' },
        { status: 503 },
      );
    }),

    // DocuSign signing URL fails
    http.post(
      'https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes/:envelopeId/views/recipient',
      () => {
        return HttpResponse.json(
          { errorCode: 'ENVELOPE_DOES_NOT_EXIST', message: 'Envelope not found' },
          { status: 404 },
        );
      },
    ),
  ];
}
