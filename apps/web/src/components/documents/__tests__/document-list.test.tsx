import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { DocumentList } from '../document-list';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    document: {
      list: {
        queryOptions: (input: unknown) => ({
          queryKey: ['document', 'list', input],
          queryFn: vi.fn(),
        }),
      },
    },
  },
}));

vi.mock('@/components/documents/document-card', () => ({
  DocumentCard: ({ document, versionNumber }: any) => (
    <div data-testid="document-card">
      {document.originalFileName} v{versionNumber}
    </div>
  ),
}));

describe('DocumentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons when loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { container } = render(<DocumentList entityType="CONTRACT" entityId="c-1" />);
    // 3 skeleton groups rendered
    const borders = container.querySelectorAll('.rounded-lg.border');
    expect(borders.length).toBeGreaterThanOrEqual(3);
  });

  it('renders empty state when no documents', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });
    render(<DocumentList entityType="CONTRACT" entityId="c-1" />);
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(
      screen.getByText('Upload contract documents to keep them organized.'),
    ).toBeInTheDocument();
  });

  it('renders document cards for each document', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          { id: 'd-1', originalFileName: 'invoice.pdf' },
          { id: 'd-2', originalFileName: 'contract.docx' },
        ],
      },
      isLoading: false,
    });
    render(<DocumentList entityType="CONTRACT" entityId="c-1" />);
    const cards = screen.getAllByTestId('document-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('invoice.pdf v2');
    expect(cards[1]).toHaveTextContent('contract.docx v1');
  });

  it('passes correct version numbers (descending)', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          { id: 'd-1', originalFileName: 'a.pdf' },
          { id: 'd-2', originalFileName: 'b.pdf' },
          { id: 'd-3', originalFileName: 'c.pdf' },
        ],
      },
      isLoading: false,
    });
    render(<DocumentList entityType="CONTRACTOR" entityId="cr-1" />);
    const cards = screen.getAllByTestId('document-card');
    expect(cards[0]).toHaveTextContent('v3');
    expect(cards[1]).toHaveTextContent('v2');
    expect(cards[2]).toHaveTextContent('v1');
  });
});
