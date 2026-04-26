import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { OrgCalendarSection } from '../org-calendar-section';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let connectionsData: unknown[] = [];
let connectionsLoading = false;
const mockMutate = vi.fn();
const mockInvalidateQueries = vi.fn();

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
      listConnections: {
        queryOptions: vi.fn(() => ({ queryKey: ['cal', 'listConnections'] })),
        queryKey: vi.fn(() => ['cal', 'listConnections']),
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
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
  mockMutate.mockClear();
  mockInvalidateQueries.mockClear();

  vi.mocked(useQueryClient).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  } as unknown as never);

  vi.mocked(useMutation).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as unknown as never);

  vi.mocked(useQuery).mockImplementation(() => {
    return { data: connectionsData, isLoading: connectionsLoading, refetch: vi.fn() } as unknown;
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgCalendarSection', () => {
  it('renders section title', () => {
    render(<OrgCalendarSection />);
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('renders Google and Outlook cards', () => {
    render(<OrgCalendarSection />);
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Outlook Calendar')).toBeInTheDocument();
  });

  it("shows 'Not connected' badges when no connections", () => {
    render(<OrgCalendarSection />);
    const badges = screen.getAllByText('Not connected');
    expect(badges.length).toBe(2);
  });

  it('shows Connect Calendar buttons', () => {
    render(<OrgCalendarSection />);
    const connectButtons = screen.getAllByText('Connect Calendar');
    expect(connectButtons.length).toBe(2);
  });

  it('renders provider icons', () => {
    render(<OrgCalendarSection />);
    expect(screen.getByTestId('google-cal-icon')).toBeInTheDocument();
    expect(screen.getByTestId('outlook-cal-icon')).toBeInTheDocument();
  });

  it('renders org calendar description text', () => {
    render(<OrgCalendarSection />);
    const descriptions = screen.getAllByText(/Events will be pushed to this shared calendar/);
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Loading state ----
  it('shows loading skeletons when connections are loading', () => {
    connectionsLoading = true;
    const { container } = render(<OrgCalendarSection />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  // ---- Connected state ----
  it("shows 'Connected' badge when Google Calendar is connected (org-level userId=null)", () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'org-calendar@company.com',
        connectedAt: '2026-02-01T00:00:00Z',
        userId: null,
        tokenExpiresAt: null,
      },
    ];
    render(<OrgCalendarSection />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('org-calendar@company.com')).toBeInTheDocument();
  });

  it('filters out user-level connections (userId not null)', () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'personal@gmail.com',
        connectedAt: '2026-02-01T00:00:00Z',
        userId: 'u1', // personal, not org-level
        tokenExpiresAt: null,
      },
    ];
    render(<OrgCalendarSection />);
    // Should NOT show as connected since it's personal
    const badges = screen.getAllByText('Not connected');
    expect(badges.length).toBe(2);
  });

  it('shows disconnect button for connected org calendar', () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'org@company.com',
        connectedAt: '2026-02-01T00:00:00Z',
        userId: null,
        tokenExpiresAt: null,
      },
    ];
    render(<OrgCalendarSection />);
    expect(screen.getByText('Disconnect Calendar')).toBeInTheDocument();
  });

  it('shows connected date when connectedAt is present', () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'OUTLOOK_CALENDAR',
        status: 'CONNECTED',
        displayName: 'outlook@company.com',
        connectedAt: '2026-03-15T00:00:00Z',
        userId: null,
        tokenExpiresAt: null,
      },
    ];
    render(<OrgCalendarSection />);
    expect(screen.getByText('Connected on:')).toBeInTheDocument();
  });

  it('clicking disconnect opens confirmation dialog', async () => {
    connectionsData = [
      {
        id: 'conn-1',
        provider: 'GOOGLE_CALENDAR',
        status: 'CONNECTED',
        displayName: 'org@company.com',
        connectedAt: '2026-02-01T00:00:00Z',
        userId: null,
        tokenExpiresAt: null,
      },
    ];
    const { user } = setup(<OrgCalendarSection />);
    await user.click(screen.getByText('Disconnect Calendar'));
    expect(screen.getByText(/Disconnect Google Calendar/)).toBeInTheDocument();
    expect(screen.getByText('Keep Connection')).toBeInTheDocument();
  });
});
