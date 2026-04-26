import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NotionAdapter } from '../notion-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['notion']),
});

beforeAll(() => {
  process.env.NOTION_CLIENT_ID = 'test-client-id';
  process.env.NOTION_CLIENT_SECRET = 'test-client-secret';
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NotionAdapter MSW integration', () => {
  const adapter = new NotionAdapter();

  it('exchangeCodeForTokens() returns tokens', async () => {
    const result = await adapter.exchangeCodeForTokens('test-code', 'http://localhost/callback');

    expect(result.accessToken).toMatch(/^ntn_mock_/);
    expect(result.tokenType).toBe('bearer');
    expect(result.extra).toBeDefined();
    expect(result.extra?.workspaceName).toBe('Test Workspace');
    expect(result.extra?.botId).toBeDefined();
    expect(result.extra?.workspaceId).toBeDefined();
  });

  it('searchPages() returns array with id and title', async () => {
    const result = await adapter.searchPages('mock-access-token', 'test query');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBeDefined();
    expect(result[0]?.title).toBe('Test Page');
    expect(result[0]?.icon).toBeDefined();
    expect(result[0]?.url).toContain('notion.so');
  });
});
