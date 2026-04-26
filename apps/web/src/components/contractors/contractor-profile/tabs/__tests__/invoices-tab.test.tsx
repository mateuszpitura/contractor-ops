import { render, screen, setup } from '@/test/test-utils';
import { InvoicesTab } from '../invoices-tab';

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn<() => Record<string, unknown>>(() => ({
    data: null,
    isLoading: false,
    isFetching: false,
    isPending: false,
  })),
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    invoice: {
      list: {
        queryOptions: (input: unknown) => ({ queryKey: ['invoice', 'list', input] }),
        queryKey: () => ['invoice', 'list'],
      },
    },
  },
}));

vi.mock('@/components/invoices/invoice-upload-area', () => ({
  InvoiceUploadArea: () => <div data-testid="upload-area" />,
}));

vi.mock('@/components/invoices/invoice-table/columns', () => ({
  getColumns: () => [],
}));

describe('InvoicesTab', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      isPending: false,
    });
  });

  it('renders empty state when no invoices', () => {
    render(<InvoicesTab contractorId="c1" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders loading skeletons', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<InvoicesTab contractorId="c1" />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders empty state heading and upload button when no invoices', () => {
    render(<InvoicesTab contractorId="c1" />);
    expect(screen.getByText(/no invoices/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('opens upload dialog when empty state upload button is clicked', async () => {
    const { user } = setup(<InvoicesTab contractorId="c1" />);
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadBtn);
    expect(screen.getByTestId('upload-area')).toBeInTheDocument();
  });

  it('renders table with data rows when invoices exist', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'inv-1',
            invoiceNumber: 'FV/001',
            issueDate: '2026-01-01',
            dueDate: '2026-02-01',
            subtotalMinor: 10000,
            totalMinor: 12300,
            currency: 'PLN',
            status: 'RECEIVED',
            matchStatus: 'UNMATCHED',
            source: 'MANUAL_UPLOAD',
            contractor: null,
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<InvoicesTab contractorId="c1" />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });
});
