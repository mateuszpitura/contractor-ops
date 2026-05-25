/**
 * Ported from apps/web/src/components/workflows/workflow-runs-table/__tests__/data-table.test.tsx.
 *
 * Web-vite WorkflowRunsDataTable spreads the full `useWorkflowRunsDataTable`
 * bag (including a real `react-table` instance). We build a real table in
 * the test and pass shaped stubs for the rest.
 */

import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findByText, mount } from '../../__tests__/_render.js';
import type { WorkflowRunRow } from '../columns.js';
import { getColumns } from '../columns.js';
import { WorkflowRunsDataTable } from '../data-table.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const t = ((key: string) => key) as (key: string, values?: Record<string, unknown>) => string;
const columns: ColumnDef<WorkflowRunRow>[] = getColumns(t);

const sampleRow: WorkflowRunRow = {
  id: 'run-1',
  status: 'IN_PROGRESS',
  dueAt: '2026-12-01',
  startedAt: '2026-04-01',
  createdAt: '2026-03-01',
  workflowTemplate: { name: 'Onboarding flow', type: 'ONBOARDING' },
  contractor: { id: 'c1', legalName: 'Acme sp. z o.o.', displayName: 'Acme' },
  progress: { done: 1, total: 3, percent: 33 },
  tasks: [],
};

function Harness(props: { overrides?: Partial<Parameters<typeof WorkflowRunsDataTable>[0]> }) {
  const overrides = props.overrides ?? {};
  const data = overrides.data ?? [];
  const totalRows = overrides.totalRows ?? data.length;
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
    getRowId: row => row.id,
  });
  const merged = {
    t,
    tAria: t,
    filters: {
      page: 1,
      pageSize: 25,
      search: '',
      sortBy: 'dueAt',
      sortOrder: 'asc',
      status: [],
      templateId: [],
      overdueOnly: false,
    },
    table,
    data,
    totalRows,
    isLoading: false,
    isRefetching: false,
    activeFilterCount: 0,
    hasFiltersOrSearch: false,
    handleFiltersChange: vi.fn(),
    handleSearchChange: vi.fn(),
    handlePageChange: vi.fn(),
    handlePageSizeChange: vi.fn(),
    clearFilters: vi.fn(),
    rowClassName: undefined,
    templates: [],
    onRowClick: vi.fn(),
    onStartWorkflow: vi.fn(),
    ...overrides,
  };
  const finalProps = {
    ...merged,
    tableLoading:
      merged.tableLoading ??
      (merged.isLoading || merged.isRefetching || merged.parentLoading === true),
    toolbarDisabled: merged.toolbarDisabled ?? (merged.isLoading || merged.parentLoading === true),
    showPaginationFooter:
      merged.showPaginationFooter ?? (!merged.isLoading && merged.totalRows > 0),
  } as Parameters<typeof WorkflowRunsDataTable>[0];
  return <WorkflowRunsDataTable {...finalProps} />;
}

describe('WorkflowRunsDataTable (web-vite)', () => {
  it('renders the toolbar and table chrome', async () => {
    await mount(<Harness />);
    expect(document.body.querySelector('table')).not.toBeNull();
  });

  it('renders skeleton rows when isLoading', async () => {
    await mount(<Harness overrides={{ isLoading: true }} />);
    expect(document.body.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders the workflow name from the data row', async () => {
    await mount(<Harness overrides={{ data: [sampleRow], totalRows: 1 }} />);
    expect(findByText(document.body, 'Onboarding flow')).not.toBeNull();
  });

  it('renders the pagination footer when there are rows', async () => {
    await mount(<Harness overrides={{ data: [sampleRow], totalRows: 50 }} />);
    const buttons = document.body.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
