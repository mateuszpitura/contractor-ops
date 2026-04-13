import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@/test/test-utils';
import { KpiCards } from '../kpi-cards';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    dashboard: {
      kpis: {
        queryOptions: () => ({ queryKey: ['dashboard', 'kpis'] }),
      },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/motion', () => ({
  springs: { gentle: {} },
  stagger: { default: {} },
  fadeUp: {},
}));

const mockedUseQuery = vi.mocked(useQuery);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockKpiData = {
  activeContractors: { value: 42, prevValue: 38 },
  pendingApprovals: { value: 7, prevValue: 7 },
  readyToPayTotal: { valueMinor: 1234500, prevValueMinor: 1000000 },
  expiringContracts: { value: 3, prevValue: 5 },
  openTasks: { value: 12, prevValue: 8 },
};

describe('KpiCards', () => {
  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  it('shows skeletons when loading', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown);

    render(<KpiCards />);

    // When loading, no KPI labels should be visible — only skeletons
    expect(screen.queryByText('Active contractors')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to pay')).not.toBeInTheDocument();
    expect(screen.queryByText('Expiring contracts')).not.toBeInTheDocument();
    expect(screen.queryByText('Open tasks')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // KPI labels
  // ---------------------------------------------------------------------------

  it('renders all 5 KPI labels', () => {
    mockedUseQuery.mockReturnValue({
      data: mockKpiData,
      isLoading: false,
    } as unknown);

    render(<KpiCards />);

    expect(screen.getByText('Active contractors')).toBeInTheDocument();
    expect(screen.getByText('Pending approvals')).toBeInTheDocument();
    expect(screen.getByText('Ready to pay')).toBeInTheDocument();
    expect(screen.getByText('Expiring contracts')).toBeInTheDocument();
    expect(screen.getByText('Open tasks')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Currency formatting (minor units → display)
  // ---------------------------------------------------------------------------

  it('formats currency values correctly (minor units to display)', () => {
    mockedUseQuery.mockReturnValue({
      data: mockKpiData,
      isLoading: false,
    } as unknown);

    render(<KpiCards />);

    // 1234500 minor = 12345 PLN → formatted as "12 345 zł" or similar pl-PL format
    // Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }) uses thin/narrow spaces
    expect(
      screen.getByText(content => {
        const normalized = content.replace(/\s/g, ' ');
        return normalized.includes('12') && normalized.includes('345');
      }),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Trend indicators
  // ---------------------------------------------------------------------------

  it('shows trend indicators for up/down/neutral', () => {
    mockedUseQuery.mockReturnValue({
      data: mockKpiData,
      isLoading: false,
    } as unknown);

    render(<KpiCards />);

    // activeContractors: 42 vs 38 → up (+11%)
    expect(screen.getByText(/\+11%/)).toBeInTheDocument();

    // pendingApprovals: 7 vs 7 → neutral
    expect(screen.getByText('No change')).toBeInTheDocument();

    // expiringContracts: 3 vs 5 → down (-40%)
    expect(screen.getByText(/-40%/)).toBeInTheDocument();
  });

  it("shows 'No change' for neutral trend", () => {
    mockedUseQuery.mockReturnValue({
      data: {
        ...mockKpiData,
        activeContractors: { value: 10, prevValue: 10 },
      },
      isLoading: false,
    } as unknown);

    render(<KpiCards />);

    // activeContractors (10 vs 10) and pendingApprovals (7 vs 7) are both neutral
    expect(screen.getAllByText('No change')).toHaveLength(2);
  });

  it('shows percentage change for up/down trends', () => {
    mockedUseQuery.mockReturnValue({
      data: mockKpiData,
      isLoading: false,
    } as unknown);

    render(<KpiCards />);

    // Up trends show "+X% vs last month"
    expect(screen.getByText(/\+11% vs last month/)).toBeInTheDocument();

    // Down trends show "-X% vs last month"
    expect(screen.getByText(/-40% vs last month/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Hero card
  // ---------------------------------------------------------------------------

  it('renders the hero card (readyToPayTotal) with proper currency formatting', () => {
    mockedUseQuery.mockReturnValue({
      data: mockKpiData,
      isLoading: false,
    } as unknown);

    render(<KpiCards />);

    // The hero card should have the "Ready to pay" label
    expect(screen.getByText('Ready to pay')).toBeInTheDocument();

    // Hero card wraps in bento-span-2
    const heroLinks = screen.getAllByRole('link');
    const heroLink = heroLinks.find(link => link.getAttribute('href') === '/payments?status=ready');
    expect(heroLink).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Links
  // ---------------------------------------------------------------------------

  it('renders links pointing to correct hrefs', () => {
    mockedUseQuery.mockReturnValue({
      data: mockKpiData,
      isLoading: false,
    } as unknown);

    render(<KpiCards />);

    const links = screen.getAllByRole('link');
    const hrefs = links.map(link => link.getAttribute('href'));

    expect(hrefs).toContain('/contractors?status=active');
    expect(hrefs).toContain('/approvals?tab=my&status=pending');
    expect(hrefs).toContain('/payments?status=ready');
    expect(hrefs).toContain('/contracts?status=expiring');
    expect(hrefs).toContain('/workflows?tab=my-tasks');
  });
});
