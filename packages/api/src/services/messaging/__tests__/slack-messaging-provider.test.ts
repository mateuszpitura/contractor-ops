import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlackMessagingProvider } from '../slack-messaging-provider.js';

const mockGetSlackUserId = vi.fn();
const mockSendApprovalCard = vi.fn();
const mockSendReminderDM = vi.fn();
const mockGetSlackClient = vi.fn();

vi.mock('../../slack-client.js', () => ({
  getSlackUserIdForUser: (...args: any[]) => mockGetSlackUserId(...args),
  sendApprovalCard: (...args: any[]) => mockSendApprovalCard(...args),
  sendReminderDM: (...args: any[]) => mockSendReminderDM(...args),
  getSlackClient: (...args: any[]) => mockGetSlackClient(...args),
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
