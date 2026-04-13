import { render, screen } from '@/test/test-utils';
import { TabDocuments } from '../tab-documents';

const mockUseQuery = vi.fn(() => ({
  data: null,
  isLoading: false,
  isFetching: false,
  isPending: false,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    document: {
      list: {
        queryOptions: (input: unknown) => ({ queryKey: ['document', 'list', input] }),
      },
    },
  },
}));

vi.mock('@/components/documents/drop-zone', () => ({
  DropZone: () => <div data-testid="drop-zone" />,
}));

vi.mock('@/components/documents/document-card', () => ({
  DocumentCard: ({ document }: any) => <div data-testid="document-card">{document.id}</div>,
}));

describe('TabDocuments', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      isPending: false,
    });
  });

  it('renders empty state with drop zone when no documents', () => {
    render(<TabDocuments contractorId="c1" />);
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });

  it('renders loading skeletons when loading', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<TabDocuments contractorId="c1" />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders empty state heading and body text', () => {
    render(<TabDocuments contractorId="c1" />);
    expect(screen.getByText(/no documents/i)).toBeInTheDocument();
  });

  it('renders document cards when documents exist', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          { id: 'doc-1', originalFileName: 'contract.pdf' },
          { id: 'doc-2', originalFileName: 'invoice.pdf' },
        ],
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabDocuments contractorId="c1" />);
    const cards = screen.getAllByTestId('document-card');
    expect(cards).toHaveLength(2);
  });

  it('renders heading when documents exist', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [{ id: 'doc-1', originalFileName: 'test.pdf' }],
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabDocuments contractorId="c1" />);
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('renders drop zone in populated state', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [{ id: 'doc-1', originalFileName: 'test.pdf' }],
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabDocuments contractorId="c1" />);
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });

  it('renders multiple skeleton items when loading', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<TabDocuments contractorId="c1" />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});
