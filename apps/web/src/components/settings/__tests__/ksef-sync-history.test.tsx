import { render, screen } from '@/test/test-utils';
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
});
