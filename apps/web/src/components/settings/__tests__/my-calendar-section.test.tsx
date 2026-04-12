import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { MyCalendarSection } from '../my-calendar-section';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let connectionsData: any[] = [];
let connectionsLoading = false;
let eventsData: any;
const mockMutate = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockFetchQuery = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    calendar: {
      listPersonalConnections: {
        queryOptions: vi.fn(() => ({ queryKey: ['cal', 'listPersonalConnections'] })),
        queryKey: vi.fn(() => ['cal', 'listPersonalConnections']),
      },
      listEvents: {
        queryOptions: vi.fn(() => ({ queryKey: ['cal', 'listEvents'] })),
        queryKey: vi.fn(() => ['cal', 'listEvents']),
      },
      disconnect: { mutationOptions: vi.fn((o: object) => o) },
    },
    integration: {
      getOAuthUrlGeneric: {
        queryOptions: vi.fn(() => ({
          queryKey: ['integration', 'getOAuthUrlGeneric'],
          enabled: false,
        })),
      },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
  usePathname: () => '/settings',
}));
vi.mock('@/components/billing/feature-gate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/integrations/provider-icons', () => ({
  GoogleCalendarIcon: () => <span data-testid="google-cal-icon" />,
  OutlookCalendarIcon: () => <span data-testid="outlook-cal-icon" />,
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  connectionsData = [];
  connectionsLoading = false;
  eventsData = undefined;
  mockMutate.mockClear();
  mockInvalidateQueries.mockClear();
  mockFetchQuery.mockClear();

  vi.mocked(useQueryClient).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
    fetchQuery: mockFetchQuery,
  } as any);

  vi.mocked(useMutation).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as any);

  vi.mocked(useQuery).mockImplementation((opts: any) => {
    // Distinguish between connections and events queries
    const key = opts?.queryKey?.[0] ?? '';
    if (key === 'cal' && opts?.queryKey?.[1] === 'listEvents') {
      return { data: eventsData, isLoading: false } as any;
    }
    return { data: connectionsData, isLoading: connectionsLoading } as any;
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyCalendarSection', () => {
  it('renders Google and Outlook calendar cards', () => {
    render(<MyCalendarSection />);
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Outlook Calendar')).toBeInTheDocument();
  });

  it('renders connect buttons when disconnected', () => {
    render(<MyCalendarSection />);
    const connectButtons = screen.getAllByText('Connect Calendar');
    expect(connectButtons.length).toBe(2);
  });

  it('renders active synced events section', () => {
    render(<MyCalendarSection />);
    expect(screen.getByText('Active Synced Events')).toBeInTheDocument();
  });

  it("shows 'Not connected' badges when no connections", () => {
    render(<MyCalendarSection />);
    const badges = screen.getAllByText('Not connected');
    expect(badges.length).toBe(2);
  });

  it('renders event count badge with 0', () => {
    render(<MyCalendarSection />);
    expect(screen.getByText('0 events synced')).toBeInTheDocument();
  });

  it('renders synced events helper text', () => {
    render(<MyCalendarSection />);
    expect(screen.getByText(/Events are automatically created/)).toBeInTheDocument();
  });

  it('renders provider icons', () => {
    render(<MyCalendarSection />);
    expect(screen.getByTestId('google-cal-icon')).toBeInTheDocument();
    expect(screen.getByTestId('outlook-cal-icon')).toBeInTheDocument();
  });

  it('renders description text for disconnected providers', () => {
    render(<MyCalendarSection />);
    const descriptions = screen.getAllByText(/Connect your calendar to receive/);
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Loading state ----
  it('shows loading skeletons when connections are loading', () => {
    connectionsLoading = true;
    const { container } = render(<MyCalendarSection />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
    // Calendar names should NOT be visible in loading state
    expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
  });

  // ---- Connected state ----
  it("shows 'Connected' badge when Google Calendar is connected", () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'user@gmail.com',
        connectedAt: '2026-01-15T00:00:00Z',
        userId: 'u1',
        tokenExpiresAt: null,
      },
    ];
    render(<MyCalendarSection />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();
  });

  it('shows connected date for connected provider', () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'user@gmail.com',
        connectedAt: '2026-01-15T00:00:00Z',
        userId: 'u1',
        tokenExpiresAt: null,
      },
    ];
    render(<MyCalendarSection />);
    expect(screen.getByText('Connected on:')).toBeInTheDocument();
  });

  it('shows Disconnect button for connected provider', () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'user@gmail.com',
        connectedAt: '2026-01-15T00:00:00Z',
        userId: 'u1',
        tokenExpiresAt: null,
      },
    ];
    render(<MyCalendarSection />);
    expect(screen.getByText('Disconnect Calendar')).toBeInTheDocument();
  });

  it('shows event count when events are loaded', () => {
    eventsData = { count: 42 };
    render(<MyCalendarSection />);
    expect(screen.getByText('42 events synced')).toBeInTheDocument();
  });

  it('shows both connected and not connected states simultaneously', () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'user@gmail.com',
        connectedAt: '2026-01-15T00:00:00Z',
        userId: 'u1',
        tokenExpiresAt: null,
      },
    ];
    render(<MyCalendarSection />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('shows disconnect button and clicking it opens confirmation dialog', async () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'user@gmail.com',
        connectedAt: '2026-01-15T00:00:00Z',
        userId: 'u1',
        tokenExpiresAt: null,
      },
    ];
    const { user } = setup(<MyCalendarSection />);
    await user.click(screen.getByText('Disconnect Calendar'));
    // The disconnect confirmation dialog should appear
    expect(screen.getByText(/Disconnect Google Calendar/)).toBeInTheDocument();
    expect(screen.getByText('Keep Connection')).toBeInTheDocument();
  });

  it('shows connected account name', () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'john@company.com',
        connectedAt: null,
        userId: 'u1',
        tokenExpiresAt: null,
      },
    ];
    render(<MyCalendarSection />);
    expect(screen.getByText('john@company.com')).toBeInTheDocument();
  });
});
