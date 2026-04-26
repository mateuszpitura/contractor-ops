import { render, screen, setup } from '@/test/test-utils';
import { DataTablePagination } from '../data-table-pagination';

const createMockTable = (selectedCount = 0) =>
  ({
    getFilteredSelectedRowModel: () => ({
      rows: Array.from({ length: selectedCount }),
    }),
  }) as unknown as never;

describe('DataTablePagination', () => {
  it('renders page indicator', () => {
    render(
      <DataTablePagination
        table={createMockTable()}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/of 100/)).toBeInTheDocument();
    expect(screen.getByText('Rows per page')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(
      <DataTablePagination
        table={createMockTable()}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    const prevBtn = screen.getByLabelText('Previous page');
    expect(prevBtn).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <DataTablePagination
        table={createMockTable()}
        totalRows={25}
        pageSize={25}
        currentPage={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    const nextBtn = screen.getByLabelText('Next page');
    expect(nextBtn).toBeDisabled();
  });

  it('calls onPageChange when clicking next', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(
      <DataTablePagination
        table={createMockTable()}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('shows selected count when rows are selected', () => {
    render(
      <DataTablePagination
        table={createMockTable(3)}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/selected/)).toBeInTheDocument();
  });
});
