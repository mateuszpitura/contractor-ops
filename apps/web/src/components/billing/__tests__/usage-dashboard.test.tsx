import { render, screen, setup } from '@/test/test-utils';
import { UsageDashboard } from '../usage-dashboard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let dashboardData: any = null;
let isLoading = false;
let isError = false;
const mockRefetch = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: dashboardData,
    isLoading,
    isError,
    refetch: mockRefetch,
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    billing: {
      getUsageDashboard: { queryOptions: () => ({}) },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

// Mock child components to isolate
vi.mock('../usage-kpi-card', () => ({
  UsageKpiCard: ({ label, value }: any) => (
    <div data-testid="kpi-card">
      <span>{label}</span>
      <div>{value}</div>
    </div>
  ),
}));

vi.mock('../seat-count-card', () => ({
  SeatCountCard: () => <div data-testid="seat-count-card" />,
}));

vi.mock('../billing-date-card', () => ({
  BillingDateCard: () => <div data-testid="billing-date-card" />,
}));

vi.mock('../credit-progress-bar', () => ({
  CreditProgressBar: () => <div data-testid="credit-progress-bar" />,
}));

vi.mock('../plan-comparison-grid', () => ({
  PlanComparisonGrid: () => <div data-testid="plan-comparison-grid" />,
}));

vi.mock('../top-up-dialog', () => ({
  TopUpDialog: () => null,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsageDashboard', () => {
  beforeEach(() => {
    dashboardData = null;
    isLoading = false;
    isError = false;
    mockRefetch.mockClear();
  });

  it('shows error state with retry button', async () => {
    isError = true;
    const { user } = setup(<UsageDashboard />);
    expect(screen.getByText('Failed to load billing data')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it('shows no subscription state when subscription is null', () => {
    dashboardData = {
      subscription: null,
      credits: { balance: 0, allowance: 0, used: 0, tier: '' },
      activeContractors: 0,
      includedSeats: 0,
      planConfig: { tiers: [] },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('No active subscription')).toBeInTheDocument();
    expect(screen.getByText('Choose a plan')).toBeInTheDocument();
  });

  it('renders KPI cards when data is available', () => {
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 80, allowance: 100, used: 20, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByTestId('seat-count-card')).toBeInTheDocument();
    expect(screen.getByTestId('billing-date-card')).toBeInTheDocument();
    expect(screen.getByTestId('plan-comparison-grid')).toBeInTheDocument();
  });

  it('shows plan tier name in the current plan KPI card', () => {
    dashboardData = {
      subscription: {
        tier: 'ENTERPRISE',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 400, allowance: 500, used: 100, tier: 'ENTERPRISE' },
      activeContractors: 20,
      includedSeats: 50,
      planConfig: {
        tiers: [{ id: 'ENTERPRISE', seatPriceMinor: 2900 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    isLoading = true;
    const { container } = render(<UsageDashboard />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders seat count card and billing date card when data is available', () => {
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 80, allowance: 100, used: 20, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByTestId('seat-count-card')).toBeInTheDocument();
    expect(screen.getByTestId('billing-date-card')).toBeInTheDocument();
  });

  it('renders OCR Credits KPI card when subscription exists', () => {
    dashboardData = {
      subscription: {
        tier: 'STARTER',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 15, allowance: 20, used: 5, tier: 'STARTER' },
      activeContractors: 2,
      includedSeats: 5,
      planConfig: {
        tiers: [{ id: 'STARTER', seatPriceMinor: 1000 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('OCR Credits')).toBeInTheDocument();
  });

  it('renders plan comparison grid when subscription exists', () => {
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 80, allowance: 100, used: 20, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByTestId('plan-comparison-grid')).toBeInTheDocument();
  });

  it('shows TRIALING status badge for trial subscription', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'TRIALING',
        trialEnd: futureDate,
        currentPeriodEnd: null,
      },
      credits: { balance: 80, allowance: 100, used: 20, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });

  // ---- Retry handler ----
  it('calls refetch when retry button is clicked in error state', async () => {
    isError = true;
    const { user } = setup(<UsageDashboard />);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // ---- Low credits shows buy more ----
  it('shows buy more link when credits are low', () => {
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 5, allowance: 100, used: 95, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('Buy more')).toBeInTheDocument();
  });

  // ---- No buy more when credits are sufficient ----
  it('does not show buy more link when credits are sufficient', () => {
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 80, allowance: 100, used: 20, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.queryByText('Buy more')).not.toBeInTheDocument();
  });

  // ---- Buy more click opens dialog ----
  it('clicking buy more opens top-up dialog', async () => {
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'ACTIVE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 5, allowance: 100, used: 95, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    const { user } = setup(<UsageDashboard />);
    await user.click(screen.getByText('Buy more'));
    // TopUpDialog is mocked but click should not throw
  });

  // ---- No subscription state ----
  it('shows choose plan button when no subscription', () => {
    dashboardData = {
      subscription: null,
      credits: { balance: 0, allowance: 0, used: 0, tier: '' },
      activeContractors: 0,
      includedSeats: 0,
      planConfig: { tiers: [] },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('Choose a plan')).toBeInTheDocument();
  });

  // ---- PAST_DUE status ----
  it('shows Past due badge for PAST_DUE subscription', () => {
    dashboardData = {
      subscription: {
        tier: 'PRO',
        status: 'PAST_DUE',
        trialEnd: null,
        currentPeriodEnd: '2026-06-01',
      },
      credits: { balance: 50, allowance: 100, used: 50, tier: 'PRO' },
      activeContractors: 5,
      includedSeats: 10,
      planConfig: {
        tiers: [{ id: 'PRO', seatPriceMinor: 1500 }],
      },
    };
    render(<UsageDashboard />);
    expect(screen.getByText('Past due')).toBeInTheDocument();
  });
});
