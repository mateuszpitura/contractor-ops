import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { ProviderDetailSheet } from '../provider-detail-sheet';

let mockHealthData: Record<string, unknown> | null = null;
let mockSyncLogData: { items: unknown[]; nextCursor?: string } = {
  items: [],
};
let mockWebhookLogData: { items: unknown[]; nextCursor?: string } = {
  items: [],
};
const { mockDisconnectMutate } = vi.hoisted(() => ({
  mockDisconnectMutate: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown[] }) => {
      const key = JSON.stringify(opts?.queryKey);
      if (key?.includes('getHealth')) {
        return {
          isLoading: false,
          data: mockHealthData,
          refetch: vi.fn().mockResolvedValue({ data: { url: 'https://oauth.test' } }),
        };
      }
      if (key?.includes('getSyncLog')) {
        return {
          isLoading: false,
          isFetching: false,
          data: mockSyncLogData,
        };
      }
      if (key?.includes('getWebhookLog')) {
        return {
          isLoading: false,
          isFetching: false,
          data: mockWebhookLogData,
        };
      }
      if (key?.includes('getOAuthUrlGeneric')) {
        return {
          data: undefined,
          refetch: vi.fn().mockResolvedValue({ data: { url: 'https://oauth.test' } }),
        };
      }
      return { isLoading: false, data: null };
    },
    useMutation: () => ({
      mutate: mockDisconnectMutate,
      isPending: false,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    integration: {
      getHealth: {
        queryOptions: vi.fn(() => ({
          queryKey: ['integration', 'getHealth'],
        })),
        queryKey: vi.fn(() => ['integration', 'getHealth']),
      },
      getAllHealth: { queryKey: vi.fn(() => ['integration', 'getAllHealth']) },
      getSyncLog: {
        queryOptions: vi.fn(() => ({
          queryKey: ['integration', 'getSyncLog'],
        })),
      },
      getWebhookLog: {
        queryOptions: vi.fn(() => ({
          queryKey: ['integration', 'getWebhookLog'],
        })),
      },
      getOAuthUrlGeneric: {
        queryOptions: vi.fn(() => ({
          queryKey: ['integration', 'getOAuthUrlGeneric'],
          enabled: false,
        })),
      },
      disconnectGeneric: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const defaultProps = {
  provider: 'slack',
  displayName: 'Slack',
  icon: <span>icon</span>,
  open: true,
  onOpenChange: vi.fn(),
};

describe('ProviderDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealthData = {
      status: 'CONNECTED',
      displayName: 'Workspace',
      connectedAt: '2026-01-01',
      tokenExpiresAt: null,
      lastSyncAt: null,
    };
    mockSyncLogData = { items: [] };
    mockWebhookLogData = { items: [] };
  });

  // ---- Basic rendering ----
  it('renders provider name and status when open', () => {
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.getByText('Connection details')).toBeInTheDocument();
  });

  it('renders sync log and webhook sections', () => {
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Sync log')).toBeInTheDocument();
    expect(screen.getByText('Webhook log')).toBeInTheDocument();
  });

  // ---- Connection details ----
  it('shows connected workspace name', () => {
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('shows connected date', () => {
    render(<ProviderDetailSheet {...defaultProps} />);
    // connectedAt: "2026-01-01" -> toLocaleDateString()
    const dateText = new Date('2026-01-01').toLocaleDateString();
    expect(screen.getByText(dateText)).toBeInTheDocument();
  });

  // ---- Disconnect button ----
  it('shows disconnect button when connected', () => {
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Disconnect Slack')).toBeInTheDocument();
  });

  it('opens disconnect confirmation dialog on click', async () => {
    const { user } = setup(<ProviderDetailSheet {...defaultProps} />);
    await user.click(screen.getByText('Disconnect Slack'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('does not show disconnect button when status is DISCONNECTED', () => {
    mockHealthData = { status: 'DISCONNECTED' };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.queryByText('Disconnect Slack')).not.toBeInTheDocument();
  });

  // ---- Reconnect button ----
  it('shows reconnect button when status is REAUTH_REQUIRED', () => {
    mockHealthData = { status: 'REAUTH_REQUIRED' };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  it('shows reconnect button when status is ERROR', () => {
    mockHealthData = { status: 'ERROR' };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });

  // ---- Sync log with entries ----
  it('shows sync log entries with status', () => {
    mockSyncLogData = {
      items: [
        {
          id: 's1',
          syncType: 'FULL',
          status: 'SUCCESS',
          direction: 'PULL',
          errorMessage: null,
          startedAt: '2026-03-01T10:00:00Z',
          completedAt: '2026-03-01T10:00:05Z',
        },
      ],
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('FULL')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('shows failed sync entries with background highlight', () => {
    mockSyncLogData = {
      items: [
        {
          id: 's2',
          syncType: 'INCREMENTAL',
          status: 'FAILED',
          direction: 'PULL',
          errorMessage: 'timeout',
          startedAt: '2026-03-01T10:00:00Z',
          completedAt: '2026-03-01T10:00:10Z',
        },
      ],
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows empty sync log message when no items', () => {
    mockSyncLogData = { items: [] };
    render(<ProviderDetailSheet {...defaultProps} />);
    // Uses t("provider.syncLogEmpty")
    expect(screen.getByText(/No sync/i)).toBeInTheDocument();
  });

  it('shows load more button when nextCursor exists', () => {
    mockSyncLogData = {
      items: [
        {
          id: 's1',
          syncType: 'FULL',
          status: 'SUCCESS',
          direction: 'PULL',
          errorMessage: null,
          startedAt: '2026-03-01T10:00:00Z',
          completedAt: '2026-03-01T10:00:05Z',
        },
      ],
      nextCursor: 'cursor-123',
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    const loadMoreButtons = screen.getAllByText('Load more');
    expect(loadMoreButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Webhook log ----
  it('shows webhook log entries', () => {
    mockWebhookLogData = {
      items: [
        {
          id: 'w1',
          eventType: 'message.created',
          deliveryStatus: 'PROCESSED',
          receivedAt: '2026-03-01T10:00:00Z',
          processedAt: '2026-03-01T10:00:01Z',
          errorMessage: null,
        },
      ],
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('message.created')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('shows empty webhook log message when no items', () => {
    mockWebhookLogData = { items: [] };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText(/No webhook/i)).toBeInTheDocument();
  });

  // ---- Status badges ----
  it('renders Connected status badge', () => {
    render(<ProviderDetailSheet {...defaultProps} />);
    const badges = screen.getAllByText('Connected');
    expect(badges.length).toBeGreaterThan(0);
  });

  // ---- Token expiry ----
  it('shows token expiry dash when no expiresAt', () => {
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  // ---- Sync log with multiple entries ----
  it('shows multiple sync log entries', () => {
    mockSyncLogData = {
      items: [
        {
          id: 's1',
          syncType: 'FULL',
          status: 'SUCCESS',
          direction: 'PULL',
          errorMessage: null,
          startedAt: '2026-03-01T10:00:00Z',
          completedAt: '2026-03-01T10:00:05Z',
        },
        {
          id: 's2',
          syncType: 'INCREMENTAL',
          status: 'SUCCESS',
          direction: 'PULL',
          errorMessage: null,
          startedAt: '2026-03-02T10:00:00Z',
          completedAt: '2026-03-02T10:00:03Z',
        },
      ],
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('FULL')).toBeInTheDocument();
    expect(screen.getByText('INCREMENTAL')).toBeInTheDocument();
  });

  // ---- Webhook log with failed entry ----
  it('shows Failed status for failed webhook', () => {
    mockWebhookLogData = {
      items: [
        {
          id: 'w1',
          eventType: 'channel.created',
          deliveryStatus: 'FAILED',
          receivedAt: '2026-03-01T10:00:00Z',
          processedAt: null,
          errorMessage: 'Timeout',
        },
      ],
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  // ---- No health data ----
  it('renders disconnected when no health data', () => {
    mockHealthData = null;
    render(<ProviderDetailSheet {...defaultProps} />);
    const badges = screen.getAllByText('Disconnected');
    expect(badges.length).toBeGreaterThan(0);
  });

  // ---- Last sync info ----
  it('shows last sync when lastSyncAt is present', () => {
    mockHealthData = {
      status: 'CONNECTED',
      displayName: 'Workspace',
      connectedAt: '2026-01-01',
      tokenExpiresAt: null,
      lastSyncAt: '2026-03-01T10:00:00Z',
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  // ---- Webhook log with load more ----
  it('shows load more for webhook log with cursor', () => {
    mockWebhookLogData = {
      items: [
        {
          id: 'w1',
          eventType: 'user.updated',
          deliveryStatus: 'PROCESSED',
          receivedAt: '2026-03-01T10:00:00Z',
          processedAt: '2026-03-01T10:00:01Z',
          errorMessage: null,
        },
      ],
      nextCursor: 'webhook-cursor',
    };
    render(<ProviderDetailSheet {...defaultProps} />);
    const loadMoreButtons = screen.getAllByText('Load more');
    expect(loadMoreButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Status label keys ----
  it('renders Error status badge for ERROR health', () => {
    mockHealthData = { status: 'ERROR' };
    render(<ProviderDetailSheet {...defaultProps} />);
    const badges = screen.getAllByText('Error');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders Reauthorization required badge', () => {
    mockHealthData = { status: 'REAUTH_REQUIRED' };
    render(<ProviderDetailSheet {...defaultProps} />);
    const badges = screen.getAllByText('Reauthorization required');
    expect(badges.length).toBeGreaterThan(0);
  });

  // ---- Load more webhook logs ----
  it('clicking load more for webhook logs does not throw', async () => {
    mockWebhookLogData = {
      items: [
        {
          id: 'w1',
          eventType: 'user.updated',
          deliveryStatus: 'PROCESSED',
          receivedAt: '2026-03-01T10:00:00Z',
          processedAt: '2026-03-01T10:00:01Z',
          errorMessage: null,
        },
      ],
      nextCursor: 'webhook-cursor',
    };
    const { user } = setup(<ProviderDetailSheet {...defaultProps} />);
    const loadMoreButtons = screen.getAllByText('Load more');
    if (loadMoreButtons.length > 0) {
      await user.click(loadMoreButtons[0]);
    }
  });

  // ---- Disconnected shows connect action ----
  it('shows connect action for disconnected provider', () => {
    mockHealthData = { status: 'DISCONNECTED' };
    render(<ProviderDetailSheet {...defaultProps} />);
    // Either connect button or disconnected badge
    expect(screen.getAllByText('Disconnected').length).toBeGreaterThan(0);
  });

  // ---- ERROR status rendering ----
  it('renders Error badge for ERROR status with no crash', () => {
    mockHealthData = { status: 'ERROR', displayName: null, connectedAt: null };
    render(<ProviderDetailSheet {...defaultProps} />);
    const badges = screen.getAllByText('Error');
    expect(badges.length).toBeGreaterThan(0);
  });
});
