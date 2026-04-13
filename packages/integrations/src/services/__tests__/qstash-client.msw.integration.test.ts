/**
 * Integration: real @upstash/qstash Client + MSW (singleton reset between runs).
 */

import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getQStashClient, resetQStashClient } from '../qstash-client.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['qstash']),
});

beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'warn',
  }),
);
afterEach(() => {
  server.resetHandlers();
  resetQStashClient();
  delete process.env.QSTASH_TOKEN;
});
afterAll(() => server.close());

describe('getQStashClient + MSW', () => {
  beforeEach(() => {
    process.env.QSTASH_TOKEN = 'qstash_test_token_msw';
    resetQStashClient();
  });

  it('publishJSON receives messageId from mock QStash', async () => {
    const client = getQStashClient();
    const result = await client.publishJSON({
      url: 'https://example.com/api/internal/hook',
      body: { kind: 'test', at: Date.now() },
    });

    expect(result.messageId).toMatch(/^msg_/);
  });
});
