import { render, screen } from '@/test/test-utils';
import { DataTableColumnToggle } from '../data-table-column-toggle';

function makeMockTable() {
  return {
    getAllColumns: () => [
      {
        id: 'displayName',
        accessorFn: () => '',
        getCanHide: () => true,
        getIsVisible: () => true,
        toggleVisibility: vi.fn(),
      },
      {
        id: 'type',
        accessorFn: () => '',
        getCanHide: () => true,
        getIsVisible: () => true,
        toggleVisibility: vi.fn(),
      },
      {
        id: 'select',
        accessorFn: undefined,
        getCanHide: () => false,
        getIsVisible: () => true,
        toggleVisibility: vi.fn(),
      },
    ],
  } as any;
}

describe('DataTableColumnToggle', () => {
  it('renders the toggle button', () => {
    render(<DataTableColumnToggle table={makeMockTable()} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('has screen reader text', () => {
    render(<DataTableColumnToggle table={makeMockTable()} />);
    expect(screen.getByText('Filters', { exact: false })).toBeInTheDocument();
  });
});
