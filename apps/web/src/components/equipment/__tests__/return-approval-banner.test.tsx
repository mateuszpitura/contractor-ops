import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, setup } from '@/test/test-utils';

vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      approveReturnRequest: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationFn: vi.fn(),
          ...opts,
        }),
      },
      rejectReturnRequest: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationFn: vi.fn(),
          ...opts,
        }),
      },
      getById: { queryKey: () => ['equipment', 'getById'] },
      listReturnRequests: { queryKey: () => ['equipment', 'listReturnRequests'] },
    },
  },
}));

import { ReturnApprovalBanner } from '../return-approval-banner';

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return setup(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const returnRequest = {
  id: 'ret-1',
  contractorName: 'Jan Kowalski',
  itemCount: 3,
  targetPointName: 'Paczkomat WAW01A',
  createdAt: '2025-03-15T10:00:00.000Z',
};

describe('ReturnApprovalBanner', () => {
  it('renders contractor name in the banner', () => {
    renderWithQuery(<ReturnApprovalBanner returnRequest={returnRequest} />);
    expect(screen.getByText(/Jan Kowalski/)).toBeInTheDocument();
  });

  it('renders approve and reject buttons', () => {
    renderWithQuery(<ReturnApprovalBanner returnRequest={returnRequest} />);
    expect(screen.getByRole('button', { name: /Approve return/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject return/i })).toBeInTheDocument();
  });

  it('renders drop-off point name', () => {
    renderWithQuery(<ReturnApprovalBanner returnRequest={returnRequest} />);
    expect(screen.getByText(/Paczkomat WAW01A/)).toBeInTheDocument();
  });

  it('opens reject confirmation dialog on reject click', async () => {
    const { user } = renderWithQuery(<ReturnApprovalBanner returnRequest={returnRequest} />);
    await user.click(screen.getByRole('button', { name: /Reject return/i }));
    // The dialog has a title "Reject return" -- use role to disambiguate
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/decline the contractor's return request/i)).toBeInTheDocument();
  });
});
