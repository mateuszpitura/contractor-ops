/**
 * `ContractCard` reaches into `usePortalDateFormatter` for org-locale date
 * rendering — stub it for stable strings. The card uses the `Link`
 * navigation shim which the harness wraps via MemoryRouter, so no extra
 * route mocking is needed.
 */

vi.mock('@/lib/format/use-portal-date-formatter.js', () => ({
  usePortalDateFormatter: () => ({
    formatDate: (v: unknown) =>
      v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''),
  }),
}));

import { render, screen } from '@/test/test-utils';

import { ContractCard, ContractCardSkeleton } from '../contract-card';

function makeContract(overrides: Partial<Parameters<typeof ContractCard>[0]['contract']> = {}) {
  return {
    id: 'ct-1',
    title: 'Web Dev Services',
    type: 'B2B',
    status: 'ACTIVE',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    currency: 'PLN',
    rateType: 'HOURLY',
    rateValueMinor: 15000,
    contractNumber: 'CTR-001',
    ...overrides,
  };
}

describe('ContractCard', () => {
  it('renders the contract title', () => {
    render(<ContractCard contract={makeContract()} />);
    expect(screen.getByText('Web Dev Services')).toBeInTheDocument();
  });

  it('renders the contract number when present', () => {
    render(<ContractCard contract={makeContract({ contractNumber: 'CTR-007' })} />);
    expect(screen.getByText('CTR-007')).toBeInTheDocument();
  });

  it('renders the formatted date range', () => {
    render(<ContractCard contract={makeContract()} />);
    expect(screen.getByText(/2025-01-01.*2025-12-31/)).toBeInTheDocument();
  });

  it('renders "Ongoing" when endDate is null', () => {
    render(<ContractCard contract={makeContract({ endDate: null })} />);
    expect(screen.getByText(/Ongoing/)).toBeInTheDocument();
  });

  it('renders the rate with the hourly period suffix', () => {
    render(<ContractCard contract={makeContract()} />);
    // 15000 minor → 150 PLN /hr
    expect(screen.getByText(/\/hr/)).toBeInTheDocument();
  });

  it('omits the rate when rateValueMinor is null', () => {
    render(<ContractCard contract={makeContract({ rateValueMinor: null, rateType: null })} />);
    expect(screen.queryByText(/\/hr/)).not.toBeInTheDocument();
  });

  it('renders the status pill text', () => {
    render(<ContractCard contract={makeContract({ status: 'ACTIVE' })} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders a link to the contract detail page', () => {
    const { container } = render(<ContractCard contract={makeContract()} />);
    expect(container.querySelector('a')?.getAttribute('href')).toContain('/portal/contracts/ct-1');
  });
});

describe('ContractCardSkeleton', () => {
  it('renders skeleton placeholders', () => {
    const { container } = render(<ContractCardSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});
