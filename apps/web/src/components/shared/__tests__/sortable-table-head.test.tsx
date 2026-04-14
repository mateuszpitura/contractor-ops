import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { SortableTableHead } from '../sortable-table-head';

function createMockHeader({
  canSort = true,
  isSorted = false as false | 'asc' | 'desc',
  isPlaceholder = false,
  headerText = 'Name',
  size = 150,
}: {
  canSort?: boolean;
  isSorted?: false | 'asc' | 'desc';
  isPlaceholder?: boolean;
  headerText?: string;
  size?: number;
} = {}) {
  const toggleSortingHandler = vi.fn(() => vi.fn());
  return {
    id: 'col-1',
    isPlaceholder,
    column: {
      getCanSort: () => canSort,
      getIsSorted: () => isSorted,
      getToggleSortingHandler: toggleSortingHandler,
      getSize: () => size,
      columnDef: {
        header: headerText,
      },
    },
    getContext: () => ({}),
  };
}

// flexRender with a string header simply returns that string
vi.mock('@tanstack/react-table', () => ({
  flexRender: (header: unknown) => header,
}));

function renderInTable(ui: React.ReactElement) {
  return render(
    <table>
      <thead>
        <tr>{ui}</tr>
      </thead>
    </table>,
  );
}

function setupInTable(ui: React.ReactElement) {
  return setup(
    <table>
      <thead>
        <tr>{ui}</tr>
      </thead>
    </table>,
  );
}

describe('SortableTableHead', () => {
  it('renders header text for a sortable column', () => {
    const header = createMockHeader();
    renderInTable(<SortableTableHead header={header as never} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders header text for a non-sortable column without button', () => {
    const header = createMockHeader({ canSort: false });
    renderInTable(<SortableTableHead header={header as never} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a sort button for sortable columns', () => {
    const header = createMockHeader();
    renderInTable(<SortableTableHead header={header as never} sortAriaLabel="Sort by name" />);
    expect(screen.getByRole('button', { name: 'Sort by name' })).toBeInTheDocument();
  });

  it('renders empty th for placeholder header', () => {
    const header = createMockHeader({ isPlaceholder: true });
    renderInTable(<SortableTableHead header={header as never} />);
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });

  it('sets aria-sort=ascending when sorted asc', () => {
    const header = createMockHeader({ isSorted: 'asc' });
    renderInTable(<SortableTableHead header={header as never} />);
    const th = screen.getByRole('columnheader');
    expect(th).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sets aria-sort=descending when sorted desc', () => {
    const header = createMockHeader({ isSorted: 'desc' });
    renderInTable(<SortableTableHead header={header as never} />);
    const th = screen.getByRole('columnheader');
    expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  it('does not set aria-sort when unsorted', () => {
    const header = createMockHeader({ isSorted: false });
    renderInTable(<SortableTableHead header={header as never} />);
    const th = screen.getByRole('columnheader');
    expect(th).not.toHaveAttribute('aria-sort');
  });

  it('calls toggle sorting handler on click', async () => {
    const header = createMockHeader();
    const handler = vi.fn();
    header.column.getToggleSortingHandler = vi.fn(() => handler);
    const { user } = setupInTable(<SortableTableHead header={header as never} />);
    await user.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalled();
  });
});
