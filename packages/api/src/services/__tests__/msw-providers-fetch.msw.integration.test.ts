/**
 * Smoke: native fetch + MSW handlers (Stripe/Jira/Linear REST/GraphQL paths).
 * Note: the Stripe *Node SDK* uses https in a way that often bypasses MSW; app code
 * that uses fetch/undici is covered by other *.msw.integration tests.
 */

import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['stripe', 'jira', 'linear']),
});

beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'warn',
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MSW provider handlers (fetch)', () => {
  it('Stripe checkout session POST returns session URL', async () => {
    const body = new URLSearchParams();
    body.set('mode', 'subscription');
    body.set('customer', 'cus_test');
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk_test_fake',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { url?: string };
    expect(json.url).toContain('checkout.stripe.com');
  });

  it('Jira REST GET issue returns mock fields', async () => {
    const res = await fetch(
      'https://api.atlassian.com/ex/jira/cloud-id-mock-001/rest/api/3/issue/TEST-1',
      {
        headers: {
          Authorization: 'Bearer atlassian_mock',
          Accept: 'application/json',
        },
      },
    );
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { fields?: { summary?: string } };
    expect(json.fields?.summary).toBe('Mock Jira Issue');
  });

  it('Linear GraphQL POST returns teams', async () => {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer lin_test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ teams { nodes { id name key } } organization { id name urlKey } }',
      }),
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as {
      data?: { teams?: { nodes?: Array<{ key?: string }> } };
    };
    expect(json.data?.teams?.nodes?.length).toBeGreaterThan(0);
  });
});
