/**
 * Integration: real Slack WebClient + MSW HTTP mocks (no @slack/web-api mock).
 * Credential blob: encryptCredentials(JSON) with SLACK_ENCRYPTION_KEY; accessToken uses encryptToken() with SLACK_TOKEN_ENCRYPTION_KEY.
 */
import { encryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { encryptToken, sendReminderDM, syncWorkspaceUsers } from '../slack-client.js';

const ORG_ID = 'org-msw-slack';
const CONN_ID = 'conn-msw-slack';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    integrationConnection: {
      findFirst: vi.fn(),
    },
    externalLink: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findFirst: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['slack']),
});

beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'warn',
  }),
);
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('slack-client + MSW', () => {
  beforeEach(() => {
    const inner = encryptToken('xoxb-msw-integration');
    const credentialsRef = encryptCredentials({ accessToken: inner }, 'slack');
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: CONN_ID,
      credentialsRef,
      status: 'CONNECTED',
    });
  });

  it('sendReminderDM reaches mock Slack chat.postMessage', async () => {
    const out = await sendReminderDM({
      organizationId: ORG_ID,
      slackUserId: 'U_TARGET',
      text: 'Hello from MSW',
    });

    expect(out).not.toBeNull();
    expect(out?.ok).toBe(true);
  });

  it('syncWorkspaceUsers uses mock users.list and creates links for matched emails', async () => {
    mockPrisma.user.findFirst.mockImplementation(async (args: { where?: { email?: string } }) => {
      const email = args.where?.email;
      if (email === 'test@example.com') return { id: 'user-a' };
      if (email === 'contractor@example.com') return { id: 'user-b' };
      return null;
    });
    mockPrisma.externalLink.findFirst.mockResolvedValue(null);

    const stats = await syncWorkspaceUsers(ORG_ID, CONN_ID);

    expect(stats).toEqual({ matched: 2, total: 2 });
    expect(mockPrisma.externalLink.create).toHaveBeenCalledTimes(2);
  });
});
