import { render, screen } from '@/test/test-utils';
import type { EquipmentRow } from '../equipment-columns';
import { getEquipmentColumns } from '../equipment-columns';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/equipment/equipment-type-icon', () => ({
  EquipmentTypeIcon: ({ type }: { type: string }) => <span data-testid="type-icon">{type}</span>,
}));

vi.mock('@/components/equipment/equipment-status-badge', () => ({
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

function renderCell(columnId: string, row: EquipmentRow) {
  const t = (key: string) => key;
  const tCommon = (key: string) => key;
  const actions = {
    onEdit: vi.fn(),
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onCreateShipment: vi.fn(),
    onRetire: vi.fn(),
  };
  const columns = getEquipmentColumns(t, tCommon, actions);
  const col = columns.find(
    c => ('accessorKey' in c && c.accessorKey === columnId) || c.id === columnId,
  );
  if (!col?.cell) throw new Error(`No cell for column ${columnId}`);
  const cellFn = col.cell as (info: unknown) => unknown;
  const result = cellFn({
    row: { original: row, getIsSelected: () => false, toggleSelected: vi.fn() },
    getValue: () => (row as unknown)[columnId],
  });
  const { container } = render(result);
  return container;
}

describe('getEquipmentColumns', () => {
  const t = (key: string) => key;
  const tCommon = (key: string) => key;
  const actions = {
    onEdit: vi.fn(),
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onCreateShipment: vi.fn(),
    onRetire: vi.fn(),
  };

  it('returns expected column count', () => {
    const columns = getEquipmentColumns(t, tCommon, actions);
    // name, serialNumber, type, status, assignee, actions = 6
    expect(columns).toHaveLength(6);
  });

  it('name column has enableHiding false', () => {
    const columns = getEquipmentColumns(t, tCommon, actions);
    const nameCol = columns.find(c => 'accessorKey' in c && c.accessorKey === 'name');
    expect(nameCol?.enableHiding).toBe(false);
  });

  it('assignee column disables sorting', () => {
    const columns = getEquipmentColumns(t, tCommon, actions);
    const assigneeCol = columns.find(c => 'id' in c && c.id === 'assignee');
    expect(assigneeCol?.enableSorting).toBe(false);
  });

  it('actions column has fixed size 50', () => {
    const columns = getEquipmentColumns(t, tCommon, actions);
    const actionsCol = columns.find(c => 'id' in c && c.id === 'actions');
    expect(actionsCol?.size).toBe(50);
  });
});

describe('getEquipmentColumns cell renderers', () => {
  it('name cell renders equipment name as link', () => {
    renderCell('name', makeRow({ name: 'ThinkPad X1', id: 'eq-1' }));
    expect(screen.getByText('ThinkPad X1')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/equipment/eq-1');
  });

  it('serialNumber cell renders serial when present', () => {
    renderCell('serialNumber', makeRow({ serialNumber: 'ABC-123' }));
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
  });

  it('serialNumber cell renders mdash when null', () => {
    const container = renderCell('serialNumber', makeRow({ serialNumber: null }));
    expect(container.textContent).toContain('—');
  });

  it('type cell renders badge with translated type key', () => {
    renderCell('type', makeRow({ type: 'LAPTOP' }));
    expect(screen.getByText('type.laptop')).toBeInTheDocument();
  });

  it('status cell renders status badge component', () => {
    // EquipmentStatusBadge is rendered; just verify no crash and content present
    const container = renderCell('status', makeRow({ status: 'AVAILABLE' }));
    expect(container.innerHTML).not.toBe('');
  });

  it("assignee cell renders 'unassigned' when no assignment", () => {
    renderCell('assignee', makeRow({ currentAssignment: null }));
    expect(screen.getByText('list.unassigned')).toBeInTheDocument();
  });

  it('assignee cell renders contractor name as link when assigned', () => {
    renderCell(
      'assignee',
      makeRow({
        currentAssignment: {
          id: 'a1',
          contractorId: 'c-1',
          contractorName: 'John Doe',
          assignedAt: '2026-01-01',
        },
      }),
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/contractors/c-1');
  });

  it('assignee cell falls back to contractorId when name is null', () => {
    renderCell(
      'assignee',
      makeRow({
        currentAssignment: {
          id: 'a1',
          contractorId: 'c-1',
          contractorName: null,
          assignedAt: '2026-01-01',
        },
      }),
    );
    expect(screen.getByText('c-1')).toBeInTheDocument();
  });
});
