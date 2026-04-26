import { render, screen } from '@/test/test-utils';
import { ContractCard, ContractCardSkeleton } from '../contract-card';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    title: 'Software Development Agreement',
    type: 'B2B',
    status: 'ACTIVE',
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    currency: 'USD',
    rateType: 'MONTHLY',
    rateValueMinor: 120000,
    contractNumber: 'CTR-2026-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContractCard', () => {
  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it('renders contract title', () => {
    render(<ContractCard contract={makeContract()} />);

    expect(screen.getByText('Software Development Agreement')).toBeInTheDocument();
  });

  it('renders contract number when provided', () => {
    render(<ContractCard contract={makeContract()} />);

    expect(screen.getByText('CTR-2026-001')).toBeInTheDocument();
  });

  it('does NOT render contract number when null', () => {
    render(<ContractCard contract={makeContract({ contractNumber: null })} />);

    expect(screen.queryByText('CTR-2026-001')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Date range
  // -------------------------------------------------------------------------

  it('formats date range correctly', () => {
    render(<ContractCard contract={makeContract()} />);

    expect(screen.getByText('Jan 2026 - Dec 2026')).toBeInTheDocument();
  });

  it('shows "Ongoing" when endDate is null', () => {
    render(<ContractCard contract={makeContract({ endDate: null })} />);

    expect(screen.getByText(/Ongoing/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Rate
  // -------------------------------------------------------------------------

  it('formats rate correctly', () => {
    render(<ContractCard contract={makeContract()} />);

    expect(screen.getByText('$1,200/mo')).toBeInTheDocument();
  });

  it('does not show rate when rateValueMinor is null', () => {
    render(<ContractCard contract={makeContract({ rateValueMinor: null, rateType: null })} />);

    expect(screen.queryByText(/\/mo/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Status badge
  // -------------------------------------------------------------------------

  it('shows capitalized status in badge', () => {
    render(<ContractCard contract={makeContract({ status: 'ACTIVE' })} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows capitalized status for EXPIRED', () => {
    render(<ContractCard contract={makeContract({ status: 'EXPIRED' })} />);

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Link
  // -------------------------------------------------------------------------

  it('links to /portal/contracts/{id}', () => {
    render(<ContractCard contract={makeContract()} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/portal/contracts/c-1');
  });
});

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

describe('ContractCardSkeleton', () => {
  it('renders without error', () => {
    const { container } = render(<ContractCardSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
  });
});
