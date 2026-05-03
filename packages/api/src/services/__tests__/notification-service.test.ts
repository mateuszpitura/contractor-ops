import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted to avoid TDZ issues with vi.mock hoisting
// ---------------------------------------------------------------------------

const {
  mockFindFirst,
  mockCreate,
  mockPrefCreate,
  mockPrefFindFirst,
  mockUserFindUnique,
  mockConnectionFindMany,
  mockConnectionFindFirst,
  mockSendAppEmail,
  mockLogError,
  mockLogWarn,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockPrefCreate: vi.fn(),
  mockPrefFindFirst: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockConnectionFindMany: vi.fn(),
  mockConnectionFindFirst: vi.fn(),
  mockSendAppEmail: vi.fn().mockResolvedValue(undefined),
  mockLogError: vi.fn(),
  mockLogWarn: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: mockLogWarn,
    error: mockLogError,
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return {
    createLogger: vi.fn(() => stub),
    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    notification: {
      findFirst: mockFindFirst,
      create: mockCreate,
    },
    userNotificationPreference: {
      findFirst: mockPrefFindFirst,
      create: mockPrefCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    integrationConnection: {
      findMany: mockConnectionFindMany,
      findFirst: mockConnectionFindFirst,
    },
  },
}));

vi.mock('../app-email.js', () => ({
  sendAppEmail: (...args: unknown[]) => mockSendAppEmail(...args),
}));

vi.mock('../email-templates.js', () => ({
  renderNotificationEmail: vi.fn().mockReturnValue({
    subject: 'Test Subject',
    react: '<div>test</div>',
  }),
}));

// messaging/index.js uses prisma.integrationConnection.findMany (mocked above)
// slack-client.js is imported by SlackMessagingProvider
vi.mock('../slack-client.js', () => ({
  getSlackClient: vi.fn().mockResolvedValue(null),
  getSlackUserIdForUser: vi.fn().mockResolvedValue(null),
  sendApprovalCard: vi.fn().mockResolvedValue(undefined),
  sendReminderDM: vi.fn().mockResolvedValue(undefined),
}));

import type { NotificationEvent } from '../notification-service.js';
import { dispatch, getOrCreatePreferences } from '../notification-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    organizationId: 'org_1',
    type: 'INVOICE_APPROVED',
    recipientUserIds: ['user_1'],
    title: 'Invoice Approved',
    body: 'Invoice #123 has been approved',
    entityType: 'INVOICE',
    entityId: 'inv_1',
    ...overrides,
  } as NotificationEvent;
}

const defaultPrefs = {
  id: 'pref_1',
  channelEmail: true,
  channelSlack: true,
  channelTeams: false,
  channelInApp: true,
  digestMode: false,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrefFindFirst.mockResolvedValue(null);
  mockPrefCreate.mockResolvedValue(defaultPrefs);
  mockFindFirst.mockResolvedValue(null); // no duplicate
  mockCreate.mockResolvedValue({ id: 'notif_1' });
  mockUserFindUnique.mockResolvedValue({ email: 'user@example.com' });
  mockConnectionFindMany.mockResolvedValue([]); // no messaging providers by default
  mockConnectionFindFirst.mockResolvedValue(null); // no channel mapping by default
});

// ---------------------------------------------------------------------------
// getOrCreatePreferences
// ---------------------------------------------------------------------------

describe('getOrCreatePreferences', () => {
  it('returns existing preference when found', async () => {
    const existing = { ...defaultPrefs, channelEmail: false };
    mockPrefFindFirst.mockResolvedValueOnce(existing);

    const result = await getOrCreatePreferences('user_1', 'org_1', 'INVOICE_APPROVED');

    expect(result).toBe(existing);
    expect(mockPrefCreate).not.toHaveBeenCalled();
  });

  it('creates default preferences when none exist', async () => {
    mockPrefFindFirst.mockResolvedValueOnce(null);

    await getOrCreatePreferences('user_1', 'org_1', 'INVOICE_APPROVED');

    expect(mockPrefCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        organizationId: 'org_1',
        notificationType: 'INVOICE_APPROVED',
        channelEmail: true,
        channelSlack: true,
        channelTeams: false,
        channelInApp: true,
        digestMode: false,
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

describe('dispatch', () => {
  it('creates an IN_APP notification for each recipient', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);

    await dispatch(makeEvent({ recipientUserIds: ['user_1', 'user_2'] }));

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        userId: 'user_1',
        channel: 'IN_APP',
        type: 'INVOICE_APPROVED',
        title: 'Invoice Approved',
        body: 'Invoice #123 has been approved',
        entityType: 'INVOICE',
        entityId: 'inv_1',
        status: 'SENT',
      }),
    });
  });

  it('includes entityType and entityId on notification records', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);

    await dispatch(
      makeEvent({
        entityType: 'CONTRACT',
        entityId: 'contract_42',
      }),
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'CONTRACT',
        entityId: 'contract_42',
      }),
    });
  });

  it('handles empty recipientUserIds gracefully (no-op)', async () => {
    await dispatch(makeEvent({ recipientUserIds: [] }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPrefFindFirst).not.toHaveBeenCalled();
  });

  it('deduplicates: silently swallows P2002 unique violation on (organizationId, dedupKey)', async () => {
    // F-ASYNC-04: dedup is enforced at the DB layer via the
    // (organizationId, dedupKey) unique constraint. The service catches the
    // P2002 unique violation, treats it as "already delivered", and does
    // NOT fire side channels (email/Slack) — another worker is responsible.
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    const uniqueErr = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockCreate.mockRejectedValueOnce(uniqueErr);

    // Should NOT throw — the dedup error is intentional.
    await expect(dispatch(makeEvent())).resolves.toBeUndefined();

    // Email send should be skipped because the IN_APP insert was deduped.
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('passes a stable dedupKey on every notification create', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);

    await dispatch(makeEvent());

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupKey: expect.stringMatching(/^user_1:INVOICE_APPROVED:inv_1:\d+$/),
      }),
    });
  });

  it('does not throw when email sending fails (fire-and-forget)', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockUserFindUnique.mockRejectedValueOnce(new Error('DB error'));

    await expect(dispatch(makeEvent())).resolves.toBeUndefined();
    // IN_APP notification should still have been created
    expect(mockCreate).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Channel alert dispatch
  // -------------------------------------------------------------------------

  it('dispatches channel alert for INVOICE_RECEIVED when channelMapping exists', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    const mockSendChannelAlert = vi.fn().mockResolvedValue(undefined);

    // First findMany call (inside per-recipient loop) returns empty
    // Second findMany call (channel alert) returns provider
    mockConnectionFindMany
      .mockResolvedValueOnce([]) // per-recipient: no messaging providers
      .mockResolvedValueOnce([{ provider: 'MICROSOFT_TEAMS' }]); // channel alert

    // Mock the TeamsMessagingProvider that gets instantiated
    const { TeamsMessagingProvider } = await import(
      '../../services/messaging/teams-messaging-provider.js'
    );
    vi.spyOn(TeamsMessagingProvider.prototype, 'sendChannelAlert').mockImplementation(
      mockSendChannelAlert,
    );

    mockConnectionFindFirst.mockResolvedValueOnce({
      configJson: { channelMapping: { invoices: 'C-CHANNEL-123' } },
    });

    await dispatch(
      makeEvent({
        type: 'INVOICE_RECEIVED' as NotificationEvent['type'],
        recipientUserIds: ['user_1'],
      }),
    );

    expect(mockSendChannelAlert).toHaveBeenCalledOnce();
    expect(mockSendChannelAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'C-CHANNEL-123',
        organizationId: 'org_1',
      }),
    );
  });

  it('does not dispatch channel alert for unmapped notification type (TRIAL_ENDING)', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockConnectionFindMany.mockResolvedValue([]);

    await dispatch(
      makeEvent({
        type: 'TRIAL_ENDING' as NotificationEvent['type'],
        recipientUserIds: ['user_1'],
      }),
    );

    // Channel alert dispatch should not call findFirst for connection lookup
    // because TRIAL_ENDING is not in the mapping
    expect(mockConnectionFindFirst).not.toHaveBeenCalled();
  });

  it('does not dispatch channel alert when no channelMapping configured', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    const mockSendChannelAlert = vi.fn();

    mockConnectionFindMany
      .mockResolvedValueOnce([]) // per-recipient
      .mockResolvedValueOnce([{ provider: 'MICROSOFT_TEAMS' }]); // channel alert

    const { TeamsMessagingProvider } = await import(
      '../../services/messaging/teams-messaging-provider.js'
    );
    vi.spyOn(TeamsMessagingProvider.prototype, 'sendChannelAlert').mockImplementation(
      mockSendChannelAlert,
    );

    mockConnectionFindFirst.mockResolvedValueOnce({
      configJson: {},
    });

    await dispatch(
      makeEvent({
        type: 'APPROVAL_REQUEST' as NotificationEvent['type'],
        recipientUserIds: ['user_1'],
      }),
    );

    expect(mockSendChannelAlert).not.toHaveBeenCalled();
  });

  it('channel alert failure does not throw', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockLogError.mockClear();

    mockConnectionFindMany
      .mockResolvedValueOnce([]) // per-recipient
      .mockResolvedValueOnce([{ provider: 'MICROSOFT_TEAMS' }]); // channel alert

    const { TeamsMessagingProvider } = await import(
      '../../services/messaging/teams-messaging-provider.js'
    );
    vi.spyOn(TeamsMessagingProvider.prototype, 'sendChannelAlert').mockRejectedValue(
      new Error('Teams API unavailable'),
    );

    mockConnectionFindFirst.mockResolvedValueOnce({
      configJson: { channelMapping: { invoices: 'C-CHANNEL-123' } },
    });

    await expect(
      dispatch(
        makeEvent({
          type: 'INVOICE_RECEIVED' as NotificationEvent['type'],
          recipientUserIds: ['user_1'],
        }),
      ),
    ).resolves.toBeUndefined();

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining('channel alert failed'),
    );
  });

  it('skips IN_APP creation when channelInApp is false', async () => {
    mockPrefFindFirst.mockResolvedValue({
      ...defaultPrefs,
      channelInApp: false,
      channelEmail: false,
      channelSlack: false,
    });

    await dispatch(makeEvent());

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('skips email when channelEmail is false', async () => {
    mockPrefFindFirst.mockResolvedValue({
      ...defaultPrefs,
      channelEmail: false,
    });

    await dispatch(makeEvent());

    // IN_APP should still be created
    expect(mockCreate).toHaveBeenCalled();
    // Email should not be sent
    expect(mockSendAppEmail).not.toHaveBeenCalled();
  });

  it('sends email when channelEmail is true and user has email', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockUserFindUnique.mockResolvedValue({ email: 'user@test.com' });

    await dispatch(makeEvent());

    expect(mockSendAppEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        from: expect.stringContaining('notifications@'),
      }),
    );
  });

  it('skips email silently when user has no email', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockUserFindUnique.mockResolvedValue({ email: null });

    await expect(dispatch(makeEvent())).resolves.toBeUndefined();
    expect(mockSendAppEmail).not.toHaveBeenCalled();
    // IN_APP should still be created
    expect(mockCreate).toHaveBeenCalled();
  });

  it('dispatches to multiple recipients independently', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    mockFindFirst.mockResolvedValue(null);

    await dispatch(
      makeEvent({
        recipientUserIds: ['user_1', 'user_2', 'user_3'],
      }),
    );

    expect(mockCreate).toHaveBeenCalledTimes(3);
    // Preferences should be checked for each user
    expect(mockPrefFindFirst).toHaveBeenCalledTimes(3);
  });

  it('creates preferences with correct notificationType', async () => {
    mockPrefFindFirst.mockResolvedValue(null);
    mockPrefCreate.mockResolvedValue(defaultPrefs);

    await dispatch(
      makeEvent({
        type: 'CONTRACT_EXPIRING' as NotificationEvent['type'],
      }),
    );

    expect(mockPrefCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notificationType: 'CONTRACT_EXPIRING',
      }),
    });
  });

  it('dispatches channel alert for APPROVAL_REQUEST to approvals channel', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    const mockSendChannelAlert = vi.fn().mockResolvedValue(undefined);

    mockConnectionFindMany
      .mockResolvedValueOnce([]) // per-recipient
      .mockResolvedValueOnce([{ provider: 'MICROSOFT_TEAMS' }]); // channel alert

    const { TeamsMessagingProvider } = await import(
      '../../services/messaging/teams-messaging-provider.js'
    );
    vi.spyOn(TeamsMessagingProvider.prototype, 'sendChannelAlert').mockImplementation(
      mockSendChannelAlert,
    );

    mockConnectionFindFirst.mockResolvedValueOnce({
      configJson: { channelMapping: { approvals: 'C-APPROVALS-1' } },
    });

    await dispatch(
      makeEvent({
        type: 'APPROVAL_REQUEST' as NotificationEvent['type'],
        recipientUserIds: ['user_1'],
      }),
    );

    expect(mockSendChannelAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'C-APPROVALS-1',
      }),
    );
  });

  it('dispatches channel alert for TASK_ASSIGNED to tasks channel', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    const mockSendChannelAlert = vi.fn().mockResolvedValue(undefined);

    mockConnectionFindMany
      .mockResolvedValueOnce([]) // per-recipient
      .mockResolvedValueOnce([{ provider: 'MICROSOFT_TEAMS' }]); // channel alert

    const { TeamsMessagingProvider } = await import(
      '../../services/messaging/teams-messaging-provider.js'
    );
    vi.spyOn(TeamsMessagingProvider.prototype, 'sendChannelAlert').mockImplementation(
      mockSendChannelAlert,
    );

    mockConnectionFindFirst.mockResolvedValueOnce({
      configJson: { channelMapping: { tasks: 'C-TASKS-1' } },
    });

    await dispatch(
      makeEvent({
        type: 'TASK_ASSIGNED' as NotificationEvent['type'],
        recipientUserIds: ['user_1'],
        entityType: 'WORKFLOW_TASK_RUN',
      }),
    );

    expect(mockSendChannelAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'C-TASKS-1',
      }),
    );
  });

  it('skips channel alert when no messaging providers connected', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);

    mockConnectionFindMany
      .mockResolvedValueOnce([]) // per-recipient
      .mockResolvedValueOnce([]); // channel alert - no providers

    await dispatch(
      makeEvent({
        type: 'INVOICE_RECEIVED' as NotificationEvent['type'],
        recipientUserIds: ['user_1'],
      }),
    );

    // No providers means no channel alert attempt
    expect(mockConnectionFindFirst).not.toHaveBeenCalled();
  });

  it('does not dispatch channel alert when channel ID resolves to null', async () => {
    mockPrefFindFirst.mockResolvedValue(defaultPrefs);
    const mockSendChannelAlert = vi.fn().mockResolvedValue(undefined);

    mockConnectionFindMany
      .mockResolvedValueOnce([]) // per-recipient
      .mockResolvedValueOnce([{ provider: 'MICROSOFT_TEAMS' }]); // channel alert

    const { TeamsMessagingProvider } = await import(
      '../../services/messaging/teams-messaging-provider.js'
    );
    vi.spyOn(TeamsMessagingProvider.prototype, 'sendChannelAlert').mockImplementation(
      mockSendChannelAlert,
    );

    // channelMapping exists but doesn't have the category
    mockConnectionFindFirst.mockResolvedValueOnce({
      configJson: { channelMapping: { contracts: 'C-CONTRACTS-1' } },
    });

    await dispatch(
      makeEvent({
        type: 'INVOICE_RECEIVED' as NotificationEvent['type'],
        recipientUserIds: ['user_1'],
      }),
    );

    expect(mockSendChannelAlert).not.toHaveBeenCalled();
  });
});
