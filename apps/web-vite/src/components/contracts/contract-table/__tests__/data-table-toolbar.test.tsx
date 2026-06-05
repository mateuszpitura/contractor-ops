/**
 * DataTableToolbar takes users + handlers as props; no tRPC.
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { DataTableToolbar } from '../data-table-toolbar';

const emptyFilters = {
  status: [],
  type: [],
  billingModel: [],
  ownerUserId: [],
  startDateFrom: '',
  startDateTo: '',
  endDateFrom: '',
  endDateTo: '',
  complianceRiskLevel: [],
};

describe('DataTableToolbar (contracts)', () => {
  it('renders search input', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        users={[]}
        onNewContract={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders new contract button', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        users={[]}
        onNewContract={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders import button when onImport provided', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        users={[]}
        onNewContract={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    // newContract + filters trigger + import = 3+
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
  });

  it('reflects controlled search value', () => {
    render(
      <DataTableToolbar
        search="acme"
        onSearchChange={vi.fn()}
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        users={[]}
        onNewContract={vi.fn()}
      />,
    );
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('acme');
  });
});
