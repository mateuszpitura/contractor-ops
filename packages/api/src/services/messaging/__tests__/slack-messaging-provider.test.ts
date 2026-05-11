import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlackMessagingProvider } from '../slack-messaging-provider';

const { mockGetSlackUserId, mockSendApprovalCard, mockSendReminderDM, mockGetSlackClient } =
  vi.hoisted(() => ({
    mockGetSlackUserId: vi.fn(),
    mockSendApprovalCard: vi.fn(),
    mockSendReminderDM: vi.fn(),
    mockGetSlackClient: vi.fn(),
  }));

vi.mock('../../slack-client', () => ({
  getSlackUserIdForUser: mockGetSlackUserId,
  sendApprovalCard: mockSendApprovalCard,
  sendReminderDM: mockSendReminderDM,
  getSlackClient: mockGetSlackClient,
}));

describe('SlackMessagingProvider', () => {
  const provider = new SlackMessagingProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates getUserId to slack-client', async () => {
    mockGetSlackUserId.mockResolvedValue('S1');
    const id = await provider.getUserId('org-1', 'u-1');
    expect(id).toBe('S1');
    expect(mockGetSlackUserId).toHaveBeenCalledWith('org-1', 'u-1');
  });

  it('sendChannelAlert throws when Slack client missing', async () => {
    mockGetSlackClient.mockResolvedValue(null);
    await expect(
      provider.sendChannelAlert({
        organizationId: 'org-1',
        channelId: 'C1',
        title: 'Alert',
        body: 'Body',
        details: [],
        viewUrl: 'https://app.example.com',
      }),
    ).rejects.toThrow(/No Slack integration/);
  });
});
