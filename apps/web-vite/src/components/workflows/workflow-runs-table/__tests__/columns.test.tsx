/**
 * getColumns is a pure factory — pass an identity translator and exercise each
 * cell.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { findByText, mount } from '../../__tests__/_render.js';
import type { WorkflowRunRow } from '../columns.js';
import { getColumns } from '../columns.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const t = ((key: string) => key) as (key: string, values?: Record<string, unknown>) => string;

function makeRow(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: 'run-1',
    status: 'IN_PROGRESS',
    dueAt: '2026-12-01',
    startedAt: '2026-04-01',
    createdAt: '2026-03-01',
    workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
    contractor: { id: 'c1', legalName: 'Acme sp. z o.o.', displayName: 'Acme' },
    progress: { done: 1, total: 3, percent: 33 },
    tasks: [],
    ...overrides,
  };
}

async function renderCell(columnId: string, row: WorkflowRunRow) {
  const columns = getColumns(t);
  const col = columns.find(
    c => ('accessorKey' in c && c.accessorKey === columnId) || c.id === columnId,
  );
  if (!col?.cell) throw new Error(`No cell for column ${columnId}`);
  const cellFn = col.cell as (info: unknown) => React.ReactElement;
  return mount(
    cellFn({
      row: {
        original: row,
        getIsSelected: () => false,
        toggleSelected: vi.fn(),
      },
      getValue: () => (row as Record<string, unknown>)[columnId],
    }),
  );
}

describe('getColumns (workflow runs)', () => {
  it('returns 8 columns', () => {
    expect(getColumns(t)).toHaveLength(8);
  });

  it('has select column first', () => {
    expect(getColumns(t)[0]?.id).toBe('select');
  });

  it('disables sorting on the progress + templateType columns', () => {
    const cols = getColumns(t);
    expect(cols.find(c => c.id === 'progress')?.enableSorting).toBe(false);
    expect(cols.find(c => c.id === 'templateType')?.enableSorting).toBe(false);
  });

  it('workflowName cell renders the template name', async () => {
    await renderCell(
      'workflowName',
      makeRow({ workflowTemplate: { name: 'Sales SOP', type: 'CUSTOM' } }),
    );
    expect(findByText(document.body, 'Sales SOP')).not.toBeNull();
  });

  it('contractor cell shows displayName when present', async () => {
    await renderCell('contractor', makeRow());
    expect(findByText(document.body, 'Acme')).not.toBeNull();
  });

  it('contractor cell falls back to legalName when displayName is null', async () => {
    await renderCell(
      'contractor',
      makeRow({ contractor: { id: 'c1', legalName: 'Beta Holdings', displayName: null } }),
    );
    expect(findByText(document.body, 'Beta Holdings')).not.toBeNull();
  });

  it('progress cell renders done/total', async () => {
    const { container } = await renderCell(
      'progress',
      makeRow({ progress: { done: 4, total: 7, percent: 57 } }),
    );
    expect(container.textContent).toContain('4/7');
  });

  it('startedAt cell renders mdash when null', async () => {
    const { container } = await renderCell('startedAt', makeRow({ startedAt: null }));
    expect(container.textContent).toContain('—');
  });

  it('dueAt cell renders mdash when null', async () => {
    const { container } = await renderCell('dueAt', makeRow({ dueAt: null }));
    expect(container.textContent).toContain('—');
  });
});
