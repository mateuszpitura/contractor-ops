import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: { findUnique: vi.fn() },
    integrationSyncLog: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { GoogleWorkspaceAdapter } from '../google-workspace-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['googleWorkspace']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GoogleWorkspaceAdapter MSW integration', () => {
  let adapter: GoogleWorkspaceAdapter;

  beforeEach(() => {
    adapter = new GoogleWorkspaceAdapter();
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    delete process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    delete process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
  });

  it('exchangeCodeForTokens() returns tokens from Google OAuth endpoint', async () => {
    const result = await adapter.exchangeCodeForTokens(
      'auth-code-123',
      'http://localhost:3000/callback',
    );

    expect(result.accessToken).toMatch(/^google_ws_mock_/);
    expect(result.refreshToken).toMatch(/^google_ws_refresh_/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.scope).toContain('admin.directory');
    expect(result.expiresAt).toBeDefined();
  });

  it('listAllDirectoryUsers() returns array of users with primaryEmail', async () => {
    const users = await adapter.listAllDirectoryUsers('mock-access-token');

    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user.primaryEmail).toBeDefined();
      expect(typeof user.primaryEmail).toBe('string');
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
    }
    expect(users[0]?.primaryEmail).toBe('john@company.com');
    expect(users[1]?.primaryEmail).toBe('jane@company.com');
  });

  it('listUserGroups() returns array of groups', async () => {
    const groups = await adapter.listUserGroups('mock-access-token', 'john@company.com');

    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.id).toBeDefined();
      expect(group.email).toBeDefined();
      expect(group.name).toBeDefined();
    }
    expect(groups[0]?.email).toBe('engineering@company.com');
    expect(groups[1]?.email).toBe('contractors@company.com');
  });
});
