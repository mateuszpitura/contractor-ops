/**
 * web-vite port. The view is now a fully-presentational component fed by the
 * `useContractorList` hook. Tests inject minimal hook output to validate
 * empty/data/loading branches.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { ContractorRow } from '../columns.js';
import { ContractorDataTable } from '../data-table.js';

function makeBulkActions() {
  return {
    onBulkArchive: vi.fn(),
    onBulkAssignOwner: vi.fn(),
    onExport: vi.fn(),
    isArchiving: false,
    isAssigningOwner: false,
    isExporting: false,
  } as never;
}

function baseProps(overrides: Partial<Parameters<typeof ContractorDataTable>[0]> = {}) {
  return {
    data: [] as ContractorRow[],
    totalRows: 0,
    users: [],
    filters: {
      search: '',
      page: 1,
      pageSize: 25,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      status: [],
      lifecycleStage: [],
      type: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
    },
    onFiltersChange: vi.fn(),
    onSearchChange: vi.fn(),
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onSortChange: vi.fn(),
    clearFilters: vi.fn(),
    isLoading: false,
    isRefetching: false,
    activeFilterCount: 0,
    hasFiltersOrSearch: false,
    bulkActions: makeBulkActions(),
    selectedRows: [],
    setSelectedRows: vi.fn(),
    columnVisibility: {},
    setColumnVisibility: vi.fn(),
    sorting: [],
    onSortingChange: vi.fn(),
    onRowClick: vi.fn(),
    onAddContractor: vi.fn(),
    toolbar: <div data-testid="stub-toolbar" />,
    ...overrides,
  } as Parameters<typeof ContractorDataTable>[0];
}

describe('ContractorDataTable', () => {
  it('renders the supplied toolbar slot + the table structure', () => {
    render(<ContractorDataTable {...baseProps()} />);
    expect(screen.getByTestId('stub-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders data rows when items are supplied', () => {
    const row: ContractorRow = {
      id: 'c-1',
      legalName: 'ACME Corp',
      displayName: 'ACME',
      type: 'COMPANY',
      status: 'ACTIVE',
      lifecycleStage: 'ACTIVE',
      currency: 'PLN',
      email: 'test@acme.pl',
      taxId: '1234567890',
      customFieldsJson: null,
      owner: null,
      primaryTeam: null,
      billingProfiles: [],
      createdAt: null,
      updatedAt: '2026-01-01T00:00:00Z',
      complianceHealth: 'green',
    };
    render(<ContractorDataTable {...baseProps({ data: [row], totalRows: 1 })} />);
    expect(screen.getByText('ACME')).toBeInTheDocument();
  });

  it('calls onRowClick when a data row is clicked', async () => {
    const row: ContractorRow = {
      id: 'c-1',
      legalName: 'ACME Corp',
      displayName: 'ACME',
      type: 'COMPANY',
      status: 'ACTIVE',
      lifecycleStage: 'ACTIVE',
      currency: 'PLN',
      email: null,
      taxId: null,
      customFieldsJson: null,
      owner: null,
      primaryTeam: null,
      billingProfiles: [],
      createdAt: null,
      updatedAt: null,
      complianceHealth: 'green',
    };
    const onRowClick = vi.fn();
    const { user } = setup(
      <ContractorDataTable {...baseProps({ data: [row], totalRows: 1, onRowClick })} />,
    );
    const acmeCell = screen.getByText('ACME');
    const tr = acmeCell.closest('tr');
    if (tr) await user.click(tr);
    expect(onRowClick).toHaveBeenCalledWith(row);
  });

  it('renders skeleton rows when isLoading', () => {
    render(<ContractorDataTable {...baseProps({ isLoading: true })} />);
    const skeletons = document.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders the toolbar slot even while refetching', () => {
    render(<ContractorDataTable {...baseProps({ isRefetching: true })} />);
    expect(screen.getByTestId('stub-toolbar')).toBeInTheDocument();
  });
});
