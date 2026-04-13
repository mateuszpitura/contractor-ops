/**
 * Slack client — WebClient factory, user mapping, DMs, workspace sync.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-slack-001';
const USER_ID = 'user-slack-001';
const CONN_ID = 'conn-slack-001';

const { mockPostMessage, mockUpdate, mockUsersList, mockPrisma, mockGetCredentials } = vi.hoisted(
  () => {
    const mockPostMessage = vi.fn(async () => ({ ok: true }));
    const mockUpdate = vi.fn(async () => ({ ok: true }));
    const mockUsersList = vi.fn(async () => ({
      members: [] as Record<string, unknown>[],
    }));

    const mockPrisma = {
      integrationConnection: {
        findFirst: vi.fn(async () => null),
      },
      externalLink: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({})),
      },
      user: {
        findFirst: vi.fn(async () => null),
      },
    };

    const mockGetCredentials = vi.fn();

    return { mockPostMessage, mockUpdate, mockUsersList, mockPrisma, mockGetCredentials };
  },
);

vi.mock('@slack/web-api', () => ({
  WebClient: class WebClient {
    chat = {
      postMessage: mockPostMessage,
      update: mockUpdate,
    };
    users = {
      list: mockUsersList,
    };
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  getCredentials: mockGetCredentials,
}));

import {
  encryptToken,
  getSlackClient,
  getSlackUserIdForUser,
  sendReminderDM,
  syncWorkspaceUsers,
} from '../slack-client.js';

describe('slack-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.integrationConnection.findFirst.mockReset();
    mockPrisma.externalLink.findFirst.mockReset();
    mockPrisma.externalLink.create.mockReset();
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    mockUsersList.mockResolvedValue({ members: [] });
    mockGetCredentials.mockResolvedValue({
      accessToken: encryptToken('xoxb-mock-token'),
    });
  });

  it('getSlackClient returns null when no connected integration', async () => {
    const client = await getSlackClient(ORG_ID);
    expect(client).toBeNull();
  });

  it('getSlackClient returns WebClient when Slack is connected', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      id: CONN_ID,
      credentialsRef: 'org-slack-001/slack',
      status: 'CONNECTED',
    });

    const client = await getSlackClient(ORG_ID);

    expect(client).not.toBeNull();
    expect(mockPrisma.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        provider: 'SLACK',
        status: 'CONNECTED',
      },
    });
    expect(mockGetCredentials).toHaveBeenCalledWith('org-slack-001/slack', 'slack');
  });

  it('getSlackUserIdForUser returns externalId from SLACK_USER link', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValueOnce({
      externalId: 'U123',
    });

    const sid = await getSlackUserIdForUser(ORG_ID, USER_ID);

    expect(sid).toBe('U123');
  });

  it('getSlackUserIdForUser falls back to second query when entityType filter misses', async () => {
    mockPrisma.externalLink.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ externalId: 'U999' });

    const sid = await getSlackUserIdForUser(ORG_ID, USER_ID);

    expect(sid).toBe('U999');
    expect(mockPrisma.externalLink.findFirst).toHaveBeenCalledTimes(2);
  });

  it('sendReminderDM returns null when Slack is not configured', async () => {
    const out = await sendReminderDM({
      organizationId: ORG_ID,
      slackUserId: 'U1',
      text: 'hello',
    });

    expect(out).toBeNull();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('sendReminderDM posts DM when client exists', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      credentialsRef: 'org-slack-001/slack',
    });

    await sendReminderDM({
      organizationId: ORG_ID,
      slackUserId: 'U1',
      text: 'Reminder',
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'U1',
        text: 'Reminder',
      }),
    );
  });

  it('syncWorkspaceUsers returns zeros when Slack is not connected', async () => {
    const stats = await syncWorkspaceUsers(ORG_ID, CONN_ID);

    expect(stats).toEqual({ matched: 0, total: 0 });
    expect(mockUsersList).not.toHaveBeenCalled();
  });

  it('syncWorkspaceUsers links users by email and creates ExternalLink rows', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({
      credentialsRef: 'org-slack-001/slack',
    });
    mockUsersList.mockResolvedValueOnce({
      members: [
        {
          id: 'USLACK1',
          is_bot: false,
          deleted: false,
          profile: { email: 'match@example.com' },
        },
        {
          id: 'USLACKBOT',
          is_bot: true,
          deleted: false,
        },
      ],
    });
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: USER_ID });
    mockPrisma.externalLink.findFirst.mockResolvedValueOnce(null);

    const stats = await syncWorkspaceUsers(ORG_ID, CONN_ID);

    expect(stats).toEqual({ matched: 1, total: 1 });
    expect(mockPrisma.externalLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        integrationConnectionId: CONN_ID,
        entityId: USER_ID,
        externalType: 'SLACK_USER',
        externalId: 'USLACK1',
      }),
    });
  });
});
