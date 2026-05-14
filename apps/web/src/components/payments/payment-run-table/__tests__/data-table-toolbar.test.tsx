import { render, screen } from '@/test/test-utils';
import { DataTableToolbar } from '../data-table-toolbar';

function makeProps(overrides: Partial<Parameters<typeof DataTableToolbar>[0]> = {}) {
  return {
    activeStatuses: [] as string[],
    onStatusChange: vi.fn(),
    dateFrom: undefined,
    dateTo: undefined,
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    ...overrides,
  };
}

describe('DataTableToolbar', () => {
  it('renders the status filter button', () => {
    render(<DataTableToolbar {...makeProps()} />);
    expect(screen.getByText(/status/i)).toBeInTheDocument();
  });

  it('renders date range button', () => {
    render(<DataTableToolbar {...makeProps()} />);
    expect(screen.getByText(/date range/i)).toBeInTheDocument();
  });

  it('shows active filter badges when statuses are selected', () => {
    render(<DataTableToolbar {...makeProps({ activeStatuses: ['DRAFT'] })} />);
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });
});
