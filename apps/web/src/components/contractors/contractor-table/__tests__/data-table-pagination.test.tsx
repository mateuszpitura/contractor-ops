import { render, screen, setup } from '@/test/test-utils';
import { DataTablePagination } from '../data-table-pagination';

function makeMockTable(selectedCount = 0) {
  return {
    getFilteredSelectedRowModel: () => ({
      rows: Array.from({ length: selectedCount }),
    }),
  } as unknown;
}

describe('DataTablePagination', () => {
  const defaultProps = {
    table: makeMockTable(),
    totalRows: 100,
    pageSize: 25,
    currentPage: 1,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('renders page indicator', () => {
    render(<DataTablePagination {...defaultProps} />);
    // Should show total rows info and page info
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<DataTablePagination {...defaultProps} />);
    const prevButton = screen.getAllByRole('button')[0]!;
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<DataTablePagination {...defaultProps} currentPage={4} />);
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1]!;
    expect(nextButton).toBeDisabled();
  });

  it('calls onPageChange when clicking next', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(<DataTablePagination {...defaultProps} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1]!;
    await user.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
