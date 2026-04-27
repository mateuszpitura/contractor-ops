import { render, screen } from '@/test/test-utils';
import { TaxObligationsWidget } from '../tax-obligations-widget';

const mockData = vi.hoisted(() => ({
  vatCollectedMinor: 150000,
  vatOwedMinor: 75000,
  vatNetMinor: 75000,
  whtWithheldMinor: 30000,
  whtCertCount: 3,
  whtPendingMinor: 10000,
  whtPendingCount: 2,
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: mockData }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    tax: {
      taxSummary: {
        queryOptions: () => ({ queryKey: ['tax.taxSummary'] }),
      },
    },
  },
}));

describe('TaxObligationsWidget', () => {
  it('renders the title', () => {
    render(<TaxObligationsWidget />);
    expect(screen.getByText('Tax Obligations')).toBeInTheDocument();
  });

  it('renders VAT section labels', () => {
    render(<TaxObligationsWidget />);
    expect(screen.getByText('VAT This Period')).toBeInTheDocument();
    expect(screen.getByText('Collected:')).toBeInTheDocument();
    expect(screen.getByText('Owed:')).toBeInTheDocument();
    expect(screen.getByText('Net:')).toBeInTheDocument();
  });

  it('renders formatted VAT amounts', () => {
    render(<TaxObligationsWidget />);
    expect(screen.getByText('1,500.00')).toBeInTheDocument();
    // 750.00 appears for both vatOwed and vatNet
    expect(screen.getAllByText('750.00')).toHaveLength(2);
  });

  it('renders WHT section', () => {
    render(<TaxObligationsWidget />);
    expect(screen.getByText('WHT This Period')).toBeInTheDocument();
    expect(screen.getByText('Withheld:')).toBeInTheDocument();
    expect(screen.getByText('300.00')).toBeInTheDocument();
  });

  it('renders WHT cert count badge', () => {
    render(<TaxObligationsWidget />);
    expect(screen.getByText('3 certs')).toBeInTheDocument();
  });

  it('renders pending WHT when amount > 0', () => {
    render(<TaxObligationsWidget />);
    expect(screen.getByText('Pending:')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('renders the View Details link', () => {
    render(<TaxObligationsWidget />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/settings/compliance');
  });
});
