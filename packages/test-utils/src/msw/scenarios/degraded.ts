import { delay, HttpResponse, http } from 'msw';

/**
 * Handlers simulating degraded external service performance.
 * Use to test timeouts, slow responses, and intermittent 503s.
 */
export function degradedHandlers() {
  return [
    // --- Jira: Very slow (5s) ---
    http.get('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey', async () => {
      await delay(5000);
      return HttpResponse.json({
        id: 'slow-issue',
        key: 'TEST-SLOW',
        fields: {
          summary: 'This took a while',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
          assignee: null,
          issuetype: { id: '10001', name: 'Task' },
          project: { id: '10000', key: 'TEST', name: 'Test' },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      });
    }),

    // --- Linear GraphQL: 503 Service Unavailable ---
    http.post('https://api.linear.app/graphql', async () => {
      await delay(2000);
      return HttpResponse.json(
        {
          errors: [
            {
              message: 'Service temporarily unavailable',
              extensions: { code: 'SERVICE_UNAVAILABLE' },
            },
          ],
        },
        { status: 503 },
      );
    }),

    // --- Slack: Timeout (10s then 504) ---
    http.post('https://slack.com/api/chat.postMessage', async () => {
      await delay(10000);
      return HttpResponse.json({ ok: false, error: 'timeout_error' }, { status: 504 });
    }),

    // --- Stripe: Slow but successful (3s) ---
    http.post('https://api.stripe.com/v1/subscriptions', async () => {
      await delay(3000);
      return HttpResponse.json({
        id: 'sub_slow',
        object: 'subscription',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      });
    }),

    // --- DocuSign: 502 Bad Gateway ---
    http.post('https://demo.docusign.net/restapi/v2.1/accounts/:accountId/envelopes', async () => {
      await delay(1000);
      return new HttpResponse('Bad Gateway', { status: 502 });
    }),

    // --- Google Calendar: Intermittent 500 ---
    http.post('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events', async () => {
      await delay(500);
      return HttpResponse.json(
        {
          error: {
            code: 500,
            message: 'Backend Error',
            errors: [{ domain: 'global', reason: 'backendError' }],
          },
        },
        { status: 500 },
      );
    }),

    // --- Resend: Slow email delivery ---
    http.post('https://api.resend.com/emails', async () => {
      await delay(4000);
      return HttpResponse.json({
        id: 'email-slow',
        from: 'noreply@contractorhub.io',
        to: ['contractor@example.com'],
        created_at: new Date().toISOString(),
      });
    }),

    // --- Claude OCR: Very slow processing ---
    http.post('https://api.anthropic.com/v1/messages', async () => {
      await delay(8000);
      return HttpResponse.json(
        { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
        { status: 529 },
      );
    }),

    // --- QStash: 503 ---
    http.post('https://qstash.upstash.io/v2/publish/*', async () => {
      await delay(1000);
      return HttpResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
    }),
  ];
}
