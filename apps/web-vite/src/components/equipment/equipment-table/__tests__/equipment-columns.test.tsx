/**
 * getEquipmentColumns is a pure factory. We render individual
 * cells through a synthetic info object to keep coverage tight, and rely on the
 * live i18n bundle for translated text from the Equipment namespace.
 */

import { describe, expect, it, vi } from 'vitest';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { render, screen } from '../../../../test/test-utils.js';
import type { EquipmentRow } from '../equipment-columns.js';
import { getEquipmentColumns } from '../equipment-columns.js';

vi.mock('../../equipment-type-icon.js', () => ({
  EquipmentTypeIcon: ({ type }: { type: string }) => <span data-testid="type-icon">{type}</span>,
}));

vi.mock('../../equipment-status-badge.js', () => ({
  EquipmentStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

function makeRow(overrides: Partial<EquipmentRow> = {}): EquipmentRow {
  return {
    id: 'eq-1',
    name: 'Laptop',
    serialNumber: 'SN-001',
    type: 'LAPTOP',
    customType: null,
    status: 'AVAILABLE',
    notes: null,
    purchaseDate: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    currentAssignment: null,
    ...overrides,
  };
}

// Bridge component — exposes the live i18n translators so we can build a
// column set inside a test render without manually replicating the runtime
// `useTranslations('Equipment')` / `useTranslations('Common')` calls.
function CellHarness({
  columnId,
  row,
  actions,
}: {
  columnId: string;
  row: EquipmentRow;
  actions: ReturnType<typeof makeActions>;
}) {
  const t = useTranslations('Equipment');
  const tCommon = useTranslations('Common');
  const columns = getEquipmentColumns(t, tCommon, actions);
  const col = columns.find(
    c => ('accessorKey' in c && c.accessorKey === columnId) || c.id === columnId,
  );
  if (!col?.cell) throw new Error(`No cell for column ${columnId}`);
  const cellFn = col.cell as (info: unknown) => React.ReactElement;
  return cellFn({
    row: { original: row, getIsSelected: () => false, toggleSelected: vi.fn() },
    getValue: () => (row as Record<string, unknown>)[columnId],
  });
}

function makeActions() {
  return {
    onEdit: vi.fn(),
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onCreateShipment: vi.fn(),
    onRetire: vi.fn(),
  };
}

// Same wrapper as above but only resolves translators — used to make
// assertions about column metadata (size, enableSorting, etc.).
function ColumnsHarness({
  onReady,
  actions,
}: {
  onReady: (cols: ReturnType<typeof getEquipmentColumns>) => void;
  actions: ReturnType<typeof makeActions>;
}) {
  const t = useTranslations('Equipment');
  const tCommon = useTranslations('Common');
  onReady(getEquipmentColumns(t, tCommon, actions));
  return null;
}

// Stable cross-test captor: avoids inline `onReady={c => …}` lambda in JSX.
type ColumnsRef = { current: ReturnType<typeof getEquipmentColumns> | undefined };
const colsRef: ColumnsRef = { current: undefined };
const resetColsRef = () => {
  colsRef.current = undefined;
};
const captureCols = (c: ReturnType<typeof getEquipmentColumns>) => {
  colsRef.current = c;
};

describe('getEquipmentColumns (web-vite)', () => {
  it('returns expected column count', () => {
    resetColsRef();
    render(<ColumnsHarness actions={makeActions()} onReady={captureCols} />);
    expect(colsRef.current).toHaveLength(7);
  });

  it('has a select column as first', () => {
    resetColsRef();
    render(<ColumnsHarness actions={makeActions()} onReady={captureCols} />);
    expect(colsRef.current?.[0]?.id).toBe('select');
    expect(colsRef.current?.[0]?.enableSorting).toBe(false);
    expect(colsRef.current?.[0]?.enableHiding).toBe(false);
  });

  it('name column has enableHiding false', () => {
    resetColsRef();
    render(<ColumnsHarness actions={makeActions()} onReady={captureCols} />);
    const nameCol = colsRef.current?.find(c => 'accessorKey' in c && c.accessorKey === 'name');
    expect(nameCol?.enableHiding).toBe(false);
  });

  it('assignee column disables sorting', () => {
    resetColsRef();
    render(<ColumnsHarness actions={makeActions()} onReady={captureCols} />);
    const assigneeCol = colsRef.current?.find(c => 'id' in c && c.id === 'assignee');
    expect(assigneeCol?.enableSorting).toBe(false);
  });

  it('actions column has fixed size 50', () => {
    resetColsRef();
    render(<ColumnsHarness actions={makeActions()} onReady={captureCols} />);
    const actionsCol = colsRef.current?.find(c => 'id' in c && c.id === 'actions');
    expect(actionsCol?.size).toBe(50);
  });
});

describe('getEquipmentColumns cell renderers (web-vite)', () => {
  it('name cell renders equipment name as locale-prefixed link', () => {
    render(
      <CellHarness
        columnId="name"
        row={makeRow({ name: 'ThinkPad X1', id: 'eq-1' })}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('ThinkPad X1')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/equipment/eq-1');
  });

  it('serialNumber cell renders serial when present', () => {
    render(
      <CellHarness
        columnId="serialNumber"
        row={makeRow({ serialNumber: 'ABC-123' })}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
  });

  it('serialNumber cell renders mdash when null', () => {
    const { container } = render(
      <CellHarness
        columnId="serialNumber"
        row={makeRow({ serialNumber: null })}
        actions={makeActions()}
      />,
    );
    expect(container.textContent).toContain('—');
  });

  it('type cell renders badge with translated type label', () => {
    render(
      <CellHarness columnId="type" row={makeRow({ type: 'LAPTOP' })} actions={makeActions()} />,
    );
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('status cell renders the status badge component (mocked)', () => {
    const { container } = render(
      <CellHarness
        columnId="status"
        row={makeRow({ status: 'AVAILABLE' })}
        actions={makeActions()}
      />,
    );
    expect(container.innerHTML).not.toBe('');
    expect(container.textContent).toContain('AVAILABLE');
  });

  it("assignee cell renders 'Unassigned' when no assignment", () => {
    render(
      <CellHarness
        columnId="assignee"
        row={makeRow({ currentAssignment: null })}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('assignee cell renders contractor name as link when assigned', () => {
    render(
      <CellHarness
        columnId="assignee"
        row={makeRow({
          currentAssignment: {
            id: 'a1',
            contractorId: 'c-1',
            contractorName: 'John Doe',
            assignedAt: '2026-01-01',
          },
        })}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/contractors/c-1');
  });

  it('assignee cell falls back to contractorId when name is null', () => {
    render(
      <CellHarness
        columnId="assignee"
        row={makeRow({
          currentAssignment: {
            id: 'a1',
            contractorId: 'c-1',
            contractorName: null,
            assignedAt: '2026-01-01',
          },
        })}
        actions={makeActions()}
      />,
    );
    expect(screen.getByText('c-1')).toBeInTheDocument();
  });
});
