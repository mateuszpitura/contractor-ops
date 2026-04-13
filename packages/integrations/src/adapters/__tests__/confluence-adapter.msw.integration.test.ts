import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConfluenceAdapter } from '../confluence-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['confluence']),
});

beforeAll(() => {
  process.env.CONFLUENCE_CLIENT_ID = 'test-client-id';
  process.env.CONFLUENCE_CLIENT_SECRET = 'test-client-secret';
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ConfluenceAdapter MSW integration', () => {
  const adapter = new ConfluenceAdapter();

  it('exchangeCodeForTokens() returns tokens', async () => {
    const result = await adapter.exchangeCodeForTokens('test-code', 'http://localhost/callback');

    expect(result.accessToken).toMatch(/^atlassian_mock_/);
    expect(result.refreshToken).toMatch(/^atlassian_refresh_/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.scope).toContain('confluence');
    expect(result.expiresAt).toBeDefined();
  });

  it('discoverCloudId() returns cloudId and siteName', async () => {
    const result = await adapter.discoverCloudId('mock-access-token');

    expect(result.cloudId).toBe('cloud-id-mock-001');
    expect(result.siteName).toBe('Test Workspace');
    expect(result.siteUrl).toBe('https://test-workspace.atlassian.net');
  });

  it('searchPages() returns array of pages', async () => {
    const result = await adapter.searchPages('mock-access-token', 'cloud-id-mock-001', 'test');

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Test Page');
    expect(result[0]?.spaceName).toBe('Test Space');
    expect(result[0]?.url).toContain('test-workspace.atlassian.net/wiki');
    expect(result[0]?.id).toBeDefined();
  });
});
