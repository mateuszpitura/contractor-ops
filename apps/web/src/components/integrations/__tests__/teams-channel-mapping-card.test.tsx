import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { TeamsChannelMappingCard } from '../teams-channel-mapping-card';

// ---------------------------------------------------------------------------
// Mocks — mock tooltip and select as simple divs to avoid jsdom hangs
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactNode;
  }) => <div>{renderProp ?? children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode; 'aria-label'?: string }) => (
    <button type="button" data-testid="select-trigger" aria-label={props['aria-label']}>
      {children}
    </button>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/billing/feature-gate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockTeams = [
  { id: 'team-1', displayName: 'General Team' },
  { id: 'team-2', displayName: 'Engineering Team' },
];

const mockChannels = [
  { id: 'ch-1', displayName: '#general' },
  { id: 'ch-2', displayName: '#approvals' },
];

let teamsData: typeof mockTeams = [];
let channelsData: typeof mockChannels = [];
let channelsLoading = false;
let channelsError = false;
let mappingData: Record<string, string> = {};

const mockMutate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey?: unknown }) => {
      const key = JSON.stringify(opts.queryKey ?? '');
      if (key.includes('getTeams')) {
        return { isLoading: false, data: teamsData };
      }
      if (key.includes('getChannels')) {
        return {
          isLoading: channelsLoading,
          isFetching: channelsLoading,
          isError: channelsError,
          data: channelsData,
        };
      }
      if (key.includes('getChannelMapping')) {
        return { isLoading: false, data: mappingData };
      }
      return { isLoading: false, data: null };
    },
    useMutation: (opts: Record<string, unknown>) => ({
      mutate: mockMutate,
      isPending: false,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    teams: {
      getTeams: {
        queryOptions: vi.fn(() => ({ queryKey: ['teams', 'getTeams'] })),
        queryKey: vi.fn(() => ['teams', 'getTeams']),
      },
      getChannels: {
        queryOptions: vi.fn(() => ({ queryKey: ['teams', 'getChannels'] })),
        queryKey: vi.fn(() => ['teams', 'getChannels']),
      },
      getChannelMapping: {
        queryOptions: vi.fn(() => ({ queryKey: ['teams', 'getChannelMapping'] })),
        queryKey: vi.fn(() => ['teams', 'getChannelMapping']),
      },
      saveChannelMapping: { mutationOptions: vi.fn(() => ({})) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamsChannelMappingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamsData = [];
    channelsData = [];
    channelsLoading = false;
    channelsError = false;
    mappingData = {};
  });

  it('renders heading', () => {
    render(<TeamsChannelMappingCard />);
    expect(screen.getByText('Channel mapping')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<TeamsChannelMappingCard />);
    expect(
      screen.getByText('Configure which channel receives each notification type.'),
    ).toBeInTheDocument();
  });

  it('renders refresh button text in tooltip', () => {
    render(<TeamsChannelMappingCard />);
    expect(screen.getByText('Refresh channel list')).toBeInTheDocument();
  });

  it('shows error message on channel fetch error', () => {
    teamsData = [mockTeams[0]];
    channelsError = true;
    render(<TeamsChannelMappingCard />);
    expect(screen.getByText(/Could not load Teams channels/)).toBeInTheDocument();
  });

  it('shows no channels message when empty and team selected', () => {
    teamsData = [mockTeams[0]];
    channelsData = [];
    channelsLoading = false;
    channelsError = false;
    render(<TeamsChannelMappingCard />);
    expect(screen.getByText(/No channels available/)).toBeInTheDocument();
  });

  it('renders category labels when channels are available', () => {
    teamsData = [mockTeams[0]];
    channelsData = mockChannels;
    render(<TeamsChannelMappingCard />);
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();
  });

  it('renders save mapping button when channels are available', () => {
    teamsData = [mockTeams[0]];
    channelsData = mockChannels;
    render(<TeamsChannelMappingCard />);
    expect(screen.getByText('Save mapping')).toBeInTheDocument();
  });

  it('does not render save button when no channels', () => {
    teamsData = [mockTeams[0]];
    channelsData = [];
    render(<TeamsChannelMappingCard />);
    expect(screen.queryByText('Save mapping')).not.toBeInTheDocument();
  });

  it('renders select triggers with aria labels for each category', () => {
    teamsData = [mockTeams[0]];
    channelsData = mockChannels;
    render(<TeamsChannelMappingCard />);
    expect(screen.getByLabelText('Approvals notification channel')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoices notification channel')).toBeInTheDocument();
  });
});
