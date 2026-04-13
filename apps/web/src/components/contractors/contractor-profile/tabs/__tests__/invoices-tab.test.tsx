import { render, screen } from '@/test/test-utils';
import { InvoicesTab } from '../invoices-tab';

const mockUseQuery = vi.fn(() => ({
  data: null,
  isLoading: false,
  isFetching: false,
  isPending: false,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

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
});
