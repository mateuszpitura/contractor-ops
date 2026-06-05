/**
 * View delegates to the canonical `DataTable` primitive; the hook bag no
 * longer carries a `useReactTable` instance, so we shape the props directly.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { findByText, mount } from '../../__tests__/_render.js';
import type { WorkflowRunRow } from '../columns.js';
import { WorkflowRunsDataTable } from '../data-table.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const t = ((key: string) => key) as (key: string, values?: Record<string, unknown>) => string;

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
  const merged: Parameters<typeof WorkflowRunsDataTable>[0] = {
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
    data,
    totalRows,
    sorting: [{ id: 'dueAt', desc: false }],
    onSortingChange: vi.fn(),
    isLoading: false,
    isRefetching: false,
    activeFilterCount: 0,
    hasFiltersOrSearch: false,
    handleFiltersChange: vi.fn(),
    handleSearchChange: vi.fn(),
    handlePageChange: vi.fn(),
    handlePageSizeChange: vi.fn(),
    clearFilters: vi.fn(),
    rowClassName: () => '',
    templates: [],
    onRowClick: vi.fn(),
    onStartWorkflow: vi.fn(),
    ...overrides,
  };
  return <WorkflowRunsDataTable {...merged} />;
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
