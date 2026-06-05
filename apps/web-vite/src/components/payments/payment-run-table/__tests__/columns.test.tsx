/**
 * Uses an echo translator (web-vite has no `createMockTranslator`).
 * Mocks the PaymentRunBadge so the status cell renders a known marker.
 */

vi.mock('../../payment-run-badge', () => ({
  PaymentRunBadge: ({ status }: { status: string }) => (
    <span data-testid="run-badge">{status}</span>
  ),
}));

import { render, screen } from '@/test/test-utils';

import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import type { PaymentRunRow } from '../columns';
import { getColumns } from '../columns';

const t: LooseTranslator = (key: unknown) => String(key);

const actions = {
  onDownloadExport: vi.fn(),
  onMarkAllPaid: vi.fn(),
  onCancelRun: vi.fn(),
};

function makeRow(overrides: Partial<PaymentRunRow> = {}): PaymentRunRow {
  return {
    id: 'run-1',
    runNumber: 'PR-001',
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    invoiceCount: 5,
    totalMinor: 500000,
    currency: 'PLN',
    exportFormat: null,
    exportedAt: null,
    ...overrides,
  };
}

function renderCell(columnId: string, row: PaymentRunRow) {
  const columns = getColumns(t, actions);
  const col = columns.find(
    c => ('accessorKey' in c && c.accessorKey === columnId) || c.id === columnId,
  );
  if (!col?.cell) throw new Error(`No cell for column ${columnId}`);
  const cellFn = col.cell as (info: unknown) => React.ReactElement | null;
  const result = cellFn({
    row: { original: row, getIsSelected: () => false, toggleSelected: vi.fn() },
    getValue: () => (row as Record<string, unknown>)[columnId],
  });
  if (result === null) return null;
  const { container } = render(result);
  // Memoized cell components wrap content in fiber elements that return null
  // internally — treat an empty-DOM render as null at the helper boundary.
  if (container.children.length === 0 && container.textContent === '') return null;
  return container;
}

describe('getColumns (payment runs)', () => {
  it('returns expected column count', () => {
    expect(getColumns(t, actions)).toHaveLength(7);
  });

  it('runNumber column disables hiding', () => {
    const col = getColumns(t, actions).find(
      c => 'accessorKey' in c && c.accessorKey === 'runNumber',
    );
    expect(col?.enableHiding).toBe(false);
  });

  it('status column disables sorting', () => {
    const col = getColumns(t, actions).find(c => 'accessorKey' in c && c.accessorKey === 'status');
    expect(col?.enableSorting).toBe(false);
  });

  it('actions column disables sorting and hiding', () => {
    const col = getColumns(t, actions).find(c => 'id' in c && c.id === 'actions');
    expect(col?.enableSorting).toBe(false);
    expect(col?.enableHiding).toBe(false);
  });
});

describe('getColumns cell renderers (payment runs)', () => {
  it('runNumber cell shows runNumber when present', () => {
    renderCell('runNumber', makeRow({ runNumber: 'PR-042' }));
    expect(screen.getByText('PR-042')).toBeInTheDocument();
  });

  it('runNumber cell falls back to truncated id when runNumber is null', () => {
    renderCell('runNumber', makeRow({ runNumber: null, id: 'abcdef1234567890' }));
    expect(screen.getByText('abcdef12')).toBeInTheDocument();
  });

  it('status cell renders PaymentRunBadge', () => {
    renderCell('status', makeRow({ status: 'EXPORTED' }));
    expect(screen.getByTestId('run-badge')).toHaveTextContent('EXPORTED');
  });

  it('invoiceCount cell renders count', () => {
    renderCell('invoiceCount', makeRow({ invoiceCount: 12 }));
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('totalMinor cell renders formatted amount with currency', () => {
    renderCell('totalMinor', makeRow({ totalMinor: 123456, currency: 'PLN' }));
    expect(screen.getByText(/1.*234,56 PLN/)).toBeInTheDocument();
  });

  it('totalMinor cell renders without currency when null', () => {
    renderCell('totalMinor', makeRow({ totalMinor: 10000, currency: null }));
    expect(screen.getByText(/100,00/)).toBeInTheDocument();
  });

  it('exportFormat cell renders format when present', () => {
    renderCell('exportFormat', makeRow({ exportFormat: 'MT103' }));
    expect(screen.getByText('MT103')).toBeInTheDocument();
  });

  it('exportFormat cell renders dash when null', () => {
    const container = renderCell('exportFormat', makeRow({ exportFormat: null }));
    expect(container?.textContent).toContain('—');
  });

  it('actions cell returns null when no actions are available', () => {
    const result = renderCell('actions', makeRow({ status: 'COMPLETED', exportedAt: null }));
    expect(result).toBeNull();
  });

  it('actions cell renders dropdown when run has DRAFT status', () => {
    const container = renderCell('actions', makeRow({ status: 'DRAFT' }));
    expect(container).not.toBeNull();
  });

  it('actions cell renders dropdown when run is EXPORTED with exportedAt', () => {
    const container = renderCell(
      'actions',
      makeRow({ status: 'EXPORTED', exportedAt: '2026-01-01T00:00:00Z' }),
    );
    expect(container).not.toBeNull();
  });
});
