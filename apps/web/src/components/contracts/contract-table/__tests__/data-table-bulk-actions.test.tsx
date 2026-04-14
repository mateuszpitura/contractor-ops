import { render, screen } from '@/test/test-utils';
import { DataTableBulkActions } from '../data-table-bulk-actions';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    contract: {
      bulkTransition: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
  },
}));

function makeMockTable(selectedCount: number) {
  const rows = Array.from({ length: selectedCount }, (_, i) => ({
    original: { id: `ct${i}` },
  }));
  return {
    getFilteredSelectedRowModel: () => ({ rows }),
    toggleAllPageRowsSelected: vi.fn(),
  } as unknown;
}

describe('DataTableBulkActions (contracts)', () => {
  it('returns null when no rows selected', () => {
    const { container } = render(<DataTableBulkActions table={makeMockTable(0)} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders action buttons when rows are selected', () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
