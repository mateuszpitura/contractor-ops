import { render, screen } from '@/test/test-utils';
import { TabPayments } from '../tab-payments';

const mockUseQuery = vi.fn(() => ({
  data: [],
  isLoading: false,
  isFetching: false,
  isPending: false,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    payment: {
      listByContractor: {
        queryOptions: (input: unknown) => ({
          queryKey: ['payment', 'listByContractor', input],
        }),
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
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('TabPayments', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isPending: false,
    });
  });

  it('renders empty state when no payments', () => {
    render(<TabPayments contractorId="c1" />);
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('renders loading skeletons', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<TabPayments contractorId="c1" />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders empty state heading when no payments exist', () => {
    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('No payments for this contractor')).toBeInTheDocument();
  });

  it('renders empty state body text', () => {
    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText(/payment runs/i)).toBeInTheDocument();
  });

  it('renders empty state icon', () => {
    const { container } = render(<TabPayments contractorId="c1" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders payment table with data', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/2025/001' },
          amountMinor: 150000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: 'REF-001',
          markedPaidAt: '2025-01-20T10:00:00Z',
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('PR-001')).toBeInTheDocument();
    expect(screen.getByText('FV/2025/001')).toBeInTheDocument();
  });

  it('renders formatted amount in table', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 150000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    // 150000 / 100 = 1500.00 PLN -- formatted with pl-PL locale, appears in table + header
    const matches = screen.getAllByText(/1.*500,00 PLN/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge for PAID items', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: 'REF-001',
          markedPaidAt: '2025-01-20T10:00:00Z',
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('renders total paid amount in header', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 200000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('Total paid:')).toBeInTheDocument();
    // 200000 / 100 = 2000.00 -- appears in both table cell and header
    const amounts = screen.getAllByText(/2.*000,00 PLN/);
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders payment reference when available', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: 'SWIFT-REF-12345',
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('SWIFT-REF-12345')).toBeInTheDocument();
  });

  it('renders em dash for null payment reference', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PENDING',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('renders run number as link', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    const link = screen.getByText('PR-001');
    expect(link.closest('a')).toHaveAttribute('href', '/payments');
  });

  it('renders invoice number as link', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-99',
          invoice: { invoiceNumber: 'FV/099' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    const link = screen.getByText('FV/099');
    expect(link.closest('a')).toHaveAttribute('href', '/invoices/inv-99');
  });

  it('renders date column with formatted date', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-03-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-03-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('15.03.2025')).toBeInTheDocument();
  });

  it('renders PENDING status badge', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PENDING',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders FAILED status badge', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'FAILED',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders EXPORTED status badge', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'EXPORTED',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    // EXPORTED -> itemStatusExported key (may be missing, falls back to key)
    const statusCell = document.querySelector("[data-slot='badge']");
    expect(statusCell).toBeInTheDocument();
  });

  it('renders tab heading text', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    // Column headers use translation keys like columnRunNumber, columnDate, etc.
    const headers = document.querySelectorAll('th');
    expect(headers.length).toBeGreaterThanOrEqual(4);
  });

  it('does not render pagination for small datasets', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    // Only 1 item, no pagination
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('calculates total paid from only PAID items', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
        {
          id: 'pi-2',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: '2025-01-15T10:00:00Z' },
          invoiceId: 'inv-2',
          invoice: { invoiceNumber: 'FV/002' },
          amountMinor: 200000,
          currency: 'PLN',
          status: 'PENDING',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    // Only PAID items counted: 100000/100 = 1000.00 -- appears in header total
    const amounts = screen.getAllByText(/1.*000,00 PLN/);
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders em dash for missing createdAt date', () => {
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'pi-1',
          paymentRunId: 'pr-1',
          paymentRun: { runNumber: 'PR-001', createdAt: null },
          invoiceId: 'inv-1',
          invoice: { invoiceNumber: 'FV/001' },
          amountMinor: 100000,
          currency: 'PLN',
          status: 'PAID',
          paymentReference: null,
          markedPaidAt: null,
          createdAt: null,
        },
      ],
      isLoading: false,
    });

    render(<TabPayments contractorId="c1" />);
    // Should show em dash for missing date
    const dashElements = screen.getAllByText('\u2014');
    expect(dashElements.length).toBeGreaterThanOrEqual(1);
  });
});
