import { HttpResponse, http } from 'msw';

/**
 * Handlers simulating rate limiting (HTTP 429) from various providers.
 * Tests that our system respects Retry-After headers and backs off properly.
 */
export function rateLimitedHandlers() {
  // Track call counts per endpoint to simulate "rate limit then succeed"
  const callCounts = new Map<string, number>();

  function getCount(key: string): number {
    const count = (callCounts.get(key) ?? 0) + 1;
    callCounts.set(key, count);
    return count;
  }

  return [
    // --- Jira: 429 on first 2 calls, then success ---
    http.get(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey',
      ({ params }) => {
        const count = getCount(`jira-issue-${params.issueKey}`);
        if (count <= 2) {
          return HttpResponse.json(
            { errorMessages: ['Rate limit exceeded'], errors: {} },
            {
              status: 429,
              headers: { 'Retry-After': '2', 'X-RateLimit-Remaining': '0' },
            },
          );
        }
        return HttpResponse.json({
          id: 'after-rate-limit',
          key: params.issueKey,
          fields: {
            summary: 'Succeeded after rate limit',
            status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
            assignee: null,
            issuetype: { id: '10001', name: 'Task' },
            project: { id: '10000', key: 'TEST', name: 'Test' },
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        });
      },
    ),

    // --- Linear: 429 with extensions ---
    http.post('https://api.linear.app/graphql', () => {
      const count = getCount('linear-graphql');
      if (count <= 1) {
        return HttpResponse.json(
          {
            errors: [
              {
                message: 'Too many requests',
                extensions: {
                  code: 'RATELIMITED',
                  retryAfterMs: 3000,
                },
              },
            ],
          },
          {
            status: 429,
            headers: { 'Retry-After': '3' },
          },
        );
      }
      return HttpResponse.json({ data: {} });
    }),

    // --- Slack: 429 with Retry-After ---
    http.post('https://slack.com/api/chat.postMessage', () => {
      const count = getCount('slack-post');
      if (count <= 1) {
        return HttpResponse.json(
          { ok: false, error: 'ratelimited' },
          {
            status: 429,
            headers: { 'Retry-After': '5' },
          },
        );
      }
      return HttpResponse.json({
        ok: true,
        channel: 'C_MOCK',
        ts: '1234567890.000001',
      });
    }),

    // --- Stripe: 429 ---
    http.post('https://api.stripe.com/v1/customers', () => {
      const count = getCount('stripe-customers');
      if (count <= 1) {
        return HttpResponse.json(
          {
            error: {
              type: 'rate_limit_error',
              message: 'Too many requests hit the API too quickly.',
            },
          },
          {
            status: 429,
            headers: { 'Retry-After': '1' },
          },
        );
      }
      return HttpResponse.json({
        id: 'cus_after_ratelimit',
        object: 'customer',
        email: 'test@example.com',
      });
    }),

    // --- Google Calendar: 429 userRateLimitExceeded ---
    http.post('https://www.googleapis.com/calendar/v3/calendars/:calendarId/events', () => {
      const count = getCount('google-calendar-create');
      if (count <= 1) {
        return HttpResponse.json(
          {
            error: {
              code: 429,
              message: 'Rate Limit Exceeded',
              errors: [
                {
                  domain: 'usageLimits',
                  reason: 'userRateLimitExceeded',
                  message: 'Rate Limit Exceeded',
                },
              ],
            },
          },
          { status: 429, headers: { 'Retry-After': '2' } },
        );
      }
      return HttpResponse.json({
        id: 'event-after-ratelimit',
        status: 'confirmed',
      });
    }),

    // --- Resend: 429 ---
    http.post('https://api.resend.com/emails', () => {
      const count = getCount('resend-send');
      if (count <= 1) {
        return HttpResponse.json(
          {
            statusCode: 429,
            message: 'Too many requests',
            name: 'rate_limit_exceeded',
          },
          { status: 429, headers: { 'Retry-After': '1' } },
        );
      }
      return HttpResponse.json({ id: 'email-after-ratelimit' });
    }),
  ];
}
