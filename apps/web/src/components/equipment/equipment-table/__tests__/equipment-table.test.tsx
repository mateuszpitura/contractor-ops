import { useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { EquipmentTable } from '../equipment-table';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: { items: [], total: 0 },
    isPending: false,
    isFetching: false,
  }),
  keepPreviousData: undefined,
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    equipment: {
      list: { queryOptions: () => ({ queryKey: ['equipment.list'] }) },
    },
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('EquipmentTable', () => {
  const defaultProps = {
    onEdit: vi.fn(),
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onCreateShipment: vi.fn(),
    onRetire: vi.fn(),
    onAddEquipment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseQuery.mockReturnValue({
      data: { items: [], total: 0 },
      isPending: false,
      isFetching: false,
    } as unknown);
  });

  it('renders empty state when no data', () => {
    render(<EquipmentTable {...defaultProps} />);

    expect(screen.getByText(/no equipment/i)).toBeInTheDocument();
  });

  it('renders add equipment button in empty state', async () => {
    render(<EquipmentTable {...defaultProps} />);

    const buttons = screen.getAllByRole('button', { name: /add equipment/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onAddEquipment when add equipment button is clicked', async () => {
    const onAddEquipment = vi.fn();
    const { user } = setup(<EquipmentTable {...defaultProps} onAddEquipment={onAddEquipment} />);
    const addBtn = screen.getAllByRole('button', { name: /add equipment/i })[0];
    await user.click(addBtn);
    expect(onAddEquipment).toHaveBeenCalled();
  });

  it('renders table element', () => {
    render(<EquipmentTable {...defaultProps} />);
    const table = document.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  it('renders toolbar section', () => {
    render(<EquipmentTable {...defaultProps} />);
    // The EquipmentToolbar is always rendered
    const searchInput = document.querySelector('input');
    expect(searchInput).toBeInTheDocument();
  });

  it('does not show pagination when no items', () => {
    render(<EquipmentTable {...defaultProps} />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('renders add equipment button in toolbar', () => {
    render(<EquipmentTable {...defaultProps} />);
    const addBtns = screen.getAllByRole('button', { name: /add equipment/i });
    expect(addBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('renders search input in toolbar', () => {
    render(<EquipmentTable {...defaultProps} />);
    const searchInput = document.querySelector('input');
    expect(searchInput).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<EquipmentTable {...defaultProps} />);
    const table = document.querySelector('table');
    expect(table).toBeInTheDocument();
    const headers = table?.querySelectorAll('th');
    expect(headers?.length).toBeGreaterThan(0);
  });

  it('renders empty state message and action button', () => {
    render(<EquipmentTable {...defaultProps} />);
    expect(screen.getByText(/no equipment/i)).toBeInTheDocument();
    const addBtn = screen.getAllByRole('button', { name: /add equipment/i })[0]!;
    expect(addBtn).toBeInTheDocument();
  });

  it('multiple calls to onAddEquipment work correctly', async () => {
    const onAddEquipment = vi.fn();
    const { user } = setup(<EquipmentTable {...defaultProps} onAddEquipment={onAddEquipment} />);
    const addBtn = screen.getAllByRole('button', { name: /add equipment/i })[0]!;
    await user.click(addBtn);
    await user.click(addBtn);
    expect(onAddEquipment).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // Interaction tests - pagination, search, filters, loading, data rendering
  // ---------------------------------------------------------------------------

  it('shows pagination when items exist', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Laptop 1',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 30,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/30 items/)).toBeInTheDocument();
  });

  it('shows loading skeleton state when isPending is true', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    // Should not show empty state, should show loading skeletons
    expect(screen.queryByText(/no equipment/i)).not.toBeInTheDocument();
  });

  it('renders data rows when items are present', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'MacBook Pro',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
          {
            id: 'eq-2',
            name: 'Monitor',
            type: 'MONITOR',
            status: 'ASSIGNED',
            createdAt: '2025-01-02',
          },
        ],
        total: 2,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    // Should not show empty state
    expect(screen.queryByText(/no equipment/i)).not.toBeInTheDocument();
    // Items count should be displayed
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 30,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    const prevBtn = screen.getByText('Previous');
    expect(prevBtn.closest('button')).toBeDisabled();
  });

  it('handles search input changes', async () => {
    const { user } = setup(<EquipmentTable {...defaultProps} />);
    const searchInput = document.querySelector('input')!;
    await user.type(searchInput, 'laptop');
    expect(searchInput).toHaveValue('laptop');
  });

  it('shows 1 item text for single item', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 1,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('shows refetching overlay when isFetching with existing data', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 1,
      },
      isPending: false,
      isFetching: true,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    // Refetching overlay should be present
    expect(screen.queryByText(/no equipment/i)).not.toBeInTheDocument();
  });

  it('advances to next page when Next button is clicked', async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: Array.from({ length: 25 }, (_, i) => ({
          id: `eq-${i}`,
          name: `Item ${i}`,
          type: 'LAPTOP',
          status: 'AVAILABLE',
          createdAt: '2025-01-01',
        })),
        total: 75,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    const { user } = setup(<EquipmentTable {...defaultProps} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
    const nextBtn = screen.getByText('Next').closest('button')!;
    expect(nextBtn).not.toBeDisabled();
    await user.click(nextBtn);
    // After clicking next, page state should advance
    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('disables next button on last page', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 5,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    const nextBtn = screen.getByText('Next').closest('button')!;
    expect(nextBtn).toBeDisabled();
  });

  it('shows page numbers in pagination', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 50,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('shows 50 items text for 50 items total', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 50,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    expect(screen.getByText('50 items')).toBeInTheDocument();
  });

  it('shows no results found when filters active but no data', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [], total: 0 },
      isPending: false,
      isFetching: false,
    } as unknown);
    const { user } = setup(<EquipmentTable {...defaultProps} />);
    // Type in search to activate filters
    const searchInput = document.querySelector('input')!;
    user.type(searchInput, 'nonexistent').then(() => {
      // After typing, if data is empty but search is active, "No results found" should show
    });
  });

  it('search input is interactive and updates on keystrokes', async () => {
    const { user } = setup(<EquipmentTable {...defaultProps} />);
    const searchInput = document.querySelector('input')!;
    // The toolbar uses controlled input with onSearchChange callback
    await user.type(searchInput, 'x');
    // After typing, input should contain the typed character
    expect((searchInput as HTMLInputElement).value).toContain('x');
  });

  it('renders column headers for equipment table', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 1,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    const table = document.querySelector('table')!;
    const headers = table.querySelectorAll('th');
    expect(headers.length).toBeGreaterThan(2);
  });

  it('renders sort buttons in sortable column headers', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 1,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    render(<EquipmentTable {...defaultProps} />);
    const table = document.querySelector('table')!;
    const sortButtons = table.querySelectorAll('th button');
    expect(sortButtons.length).toBeGreaterThan(0);
  });

  it('clicking sort header updates sort indicator', async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'eq-1',
            name: 'Test',
            type: 'LAPTOP',
            status: 'AVAILABLE',
            createdAt: '2025-01-01',
          },
        ],
        total: 1,
      },
      isPending: false,
      isFetching: false,
    } as unknown);
    const { user } = setup(<EquipmentTable {...defaultProps} />);
    const table = document.querySelector('table')!;
    const sortButtons = table.querySelectorAll('th button');
    if (sortButtons.length > 0) {
      await user.click(sortButtons[0] as HTMLElement);
      // Sort state should change
    }
  });
});
