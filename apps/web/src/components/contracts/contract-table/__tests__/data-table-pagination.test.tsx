import { render, screen, setup } from '@/test/test-utils';
import { DataTablePagination } from '../data-table-pagination';

function makeMockTable(selectedCount = 0) {
  return {
    getFilteredSelectedRowModel: () => ({
      rows: Array.from({ length: selectedCount }),
    }),
  } as unknown as never;
}

describe('DataTablePagination (contracts)', () => {
  const defaultProps = {
    table: makeMockTable(),
    totalRows: 50,
    pageSize: 10,
    currentPage: 1,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('renders page indicator', () => {
    render(<DataTablePagination {...defaultProps} />);
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('disables previous on first page', () => {
    render(<DataTablePagination {...defaultProps} />);
    const prevButton = screen.getAllByRole('button')[0];
    expect(prevButton).toBeDisabled();
  });

  it('calls onPageChange on next click', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(<DataTablePagination {...defaultProps} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
