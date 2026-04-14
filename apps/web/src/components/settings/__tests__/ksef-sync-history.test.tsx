import { render, screen, setup } from '@/test/test-utils';
import { KsefSyncHistory } from '../ksef-sync-history';

const mockData = {
  logs: [
    {
      id: 'log-1',
      syncType: 'FULL',
      status: 'SUCCESS',
      direction: 'INBOUND',
      errorMessage: null,
      responsePayloadJson: { invoicesCreated: 3 },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    {
      id: 'log-2',
      syncType: 'FULL',
      status: 'SUCCESS',
      direction: 'INBOUND',
      errorMessage: null,
      responsePayloadJson: { invoicesCreated: 0 },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  ],
};

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: mockData }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    ksef: {
      syncHistory: {
        queryOptions: vi.fn(() => ({ queryKey: ['ksef', 'syncHistory'] })),
      },
    },
  },
}));

describe('KsefSyncHistory', () => {
  it('renders collapsible trigger with title', () => {
    render(<KsefSyncHistory connectionId="conn-1" />);
    expect(screen.getByText('Sync History')).toBeInTheDocument();
  });

  it('renders sync log entries with status badges after expanding', async () => {
    const { user } = setup(<KsefSyncHistory connectionId="conn-1" />);
    // Click to expand
    await user.click(screen.getByText('Sync History'));
    // First log has invoicesCreated=3 so should show invoice count badge
    expect(screen.getByText(/3 invoices/i)).toBeInTheDocument();
  });

  it('shows "No new" badge for success with zero invoices created', async () => {
    const { user } = setup(<KsefSyncHistory connectionId="conn-1" />);
    await user.click(screen.getByText('Sync History'));
    // Second log has invoicesCreated=0 and status SUCCESS, so "No new" text
    expect(screen.getByText(/no new/i)).toBeInTheDocument();
  });

  it('renders relative timestamps for each log entry', async () => {
    const { user } = setup(<KsefSyncHistory connectionId="conn-1" />);
    await user.click(screen.getByText('Sync History'));
    // Both logs have startedAt = now, so "less than a minute ago" or similar
    const timeTexts = screen.getAllByText(/ago|just now|less than/i);
    expect(timeTexts.length).toBeGreaterThanOrEqual(1);
  });
});
