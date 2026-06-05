/**
 * The toolbar reads translations + `useDateFormatter`; `useDateFormatter`
 * reaches into tRPC for org settings, so we stub it to a stable formatter
 * to keep the test focused on prop wiring.
 */

vi.mock('@/lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')),
    formatTime: () => '',
    formatDateTime: () => '',
  }),
}));

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
    expect(screen.getAllByText(/status/i).length).toBeGreaterThan(0);
  });

  it('renders the date range button', () => {
    render(<DataTableToolbar {...makeProps()} />);
    expect(screen.getByText(/date range/i)).toBeInTheDocument();
  });

  it('shows the active filter badge with the status label when statuses are selected', () => {
    render(<DataTableToolbar {...makeProps({ activeStatuses: ['DRAFT'] })} />);
    // Status pill renders the lowercase filter label
    expect(screen.getAllByText(/draft/i).length).toBeGreaterThan(0);
  });
});
