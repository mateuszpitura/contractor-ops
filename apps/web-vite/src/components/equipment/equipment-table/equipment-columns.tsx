import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { ColumnDef, Row, Table } from '@tanstack/react-table';
import { Archive, MoreHorizontal, Pencil, Truck, UserMinus, UserPlus } from 'lucide-react';
import { memo, useCallback } from 'react';

import { Link } from '../../../i18n/navigation.js';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tKey } from '../../../i18n/typed-keys.js';
import { enumKey } from '../../../lib/enum-key.js';
import { EquipmentStatusBadge } from '../equipment-status-badge.js';
import { EquipmentTypeIcon } from '../equipment-type-icon.js';

function stopRowPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

// ---------------------------------------------------------------------------
// Row type matching tRPC equipment.list response shape
// ---------------------------------------------------------------------------

export type EquipmentRow = {
  id: string;
  name: string;
  serialNumber: string | null;
  type: string;
  customType: string | null;
  status: string;
  notes: string | null;
  purchaseDate: string | null;
  createdAt: string;
  updatedAt: string;
  currentAssignment: {
    id: string;
    contractorId: string;
    contractorName: string | null;
    assignedAt: string;
  } | null;
};

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

interface ColumnActions {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
}

const SelectAllHeader = memo(function SelectAllHeader({
  table,
  label,
}: {
  table: Table<EquipmentRow>;
  label: string;
}) {
  const handleChange = useCallback(
    (value: boolean) => table.toggleAllPageRowsSelected(!!value),
    [table],
  );
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
      onCheckedChange={handleChange}
      aria-label={label}
    />
  );
});

const SelectRowCell = memo(function SelectRowCell({
  row,
  label,
}: {
  row: Row<EquipmentRow>;
  label: string;
}) {
  const handleChange = useCallback((value: boolean) => row.toggleSelected(!!value), [row]);
  return (
    <Checkbox checked={row.getIsSelected()} onCheckedChange={handleChange} aria-label={label} />
  );
});

const NameCell = memo(function NameCell({ row }: { row: Row<EquipmentRow> }) {
  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <EquipmentTypeIcon type={row.original.type} />
      <Link
        href={`/equipment/${row.original.id}`}
        className="font-medium hover:underline"
        onClick={stopRowPropagation}>
        {row.original.name}
      </Link>
    </div>
  );
});

function AssigneeCell({
  row,
  unassignedLabel,
}: {
  row: Row<EquipmentRow>;
  unassignedLabel: string;
}) {
  const assignment = row.original.currentAssignment;
  if (!assignment) {
    return <span className="text-sm text-muted-foreground">{unassignedLabel}</span>;
  }
  return (
    <Link
      href={`/contractors/${assignment.contractorId}`}
      className="text-sm hover:underline"
      onClick={stopRowPropagation}>
      {assignment.contractorName ?? assignment.contractorId}
    </Link>
  );
}

function ActionsTriggerButton(
  props: React.HTMLAttributes<HTMLButtonElement> & { 'aria-label'?: string },
) {
  const { 'aria-label': ariaLabel, ...rest } = props;
  return (
    <Button {...rest} variant="ghost" size="icon-sm" onClick={stopRowPropagation}>
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">{ariaLabel}</span>
    </Button>
  );
}

const ActionsCell = memo(function ActionsCell({
  equipment,
  actions,
  t,
  moreActionsLabel,
}: {
  equipment: EquipmentRow;
  actions: ColumnActions;
  t: LooseTranslator;
  moreActionsLabel: string;
}) {
  const isAssigned = equipment.status === 'ASSIGNED';
  const isRetired = equipment.status === 'RETIRED';

  const handleEdit = useCallback(() => actions.onEdit(equipment), [actions, equipment]);
  const handleAssign = useCallback(() => actions.onAssign(equipment), [actions, equipment]);
  const handleUnassign = useCallback(() => actions.onUnassign(equipment), [actions, equipment]);
  const handleCreateShipment = useCallback(
    () => actions.onCreateShipment(equipment),
    [actions, equipment],
  );
  const handleRetire = useCallback(() => actions.onRetire(equipment), [actions, equipment]);

  const renderTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <ActionsTriggerButton {...props} aria-label={moreActionsLabel} />
    ),
    [moreActionsLabel],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={renderTrigger} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleEdit}>
          <Pencil className="me-2 h-3.5 w-3.5" />
          {t('detail.edit')}
        </DropdownMenuItem>
        {!(isRetired || isAssigned) && (
          <DropdownMenuItem onSelect={handleAssign}>
            <UserPlus className="me-2 h-3.5 w-3.5" />
            {t('detail.assignToContractor')}
          </DropdownMenuItem>
        )}
        {isAssigned && (
          <DropdownMenuItem onSelect={handleUnassign}>
            <UserMinus className="me-2 h-3.5 w-3.5" />
            {t('detail.unassignEquipment')}
          </DropdownMenuItem>
        )}
        {!isRetired && (
          <DropdownMenuItem onSelect={handleCreateShipment}>
            <Truck className="me-2 h-3.5 w-3.5" />
            {t('detail.createShipment')}
          </DropdownMenuItem>
        )}
        {!isRetired && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleRetire}>
              <Archive className="me-2 h-3.5 w-3.5" />
              {t('detail.retire')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export function getEquipmentColumns(
  t: LooseTranslator,
  tCommon: LooseTranslator,
  actions: ColumnActions,
): ColumnDef<EquipmentRow>[] {
  const selectAllLabel = t('list.columns.selectAll');
  const selectRowLabel = t('list.columns.selectRow');
  const unassignedLabel = t('list.unassigned');
  const moreActionsLabel = tCommon('srOnly.moreActions');

  return [
    {
      id: 'select',
      header: ({ table }) => <SelectAllHeader table={table} label={selectAllLabel} />,
      cell: ({ row }) => <SelectRowCell row={row} label={selectRowLabel} />,
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'name',
      header: t('list.columns.name'),
      cell: ({ row }) => <NameCell row={row} />,
      enableHiding: false,
    },
    {
      accessorKey: 'serialNumber',
      header: t('list.columns.serialNumber'),
      cell: ({ row }) =>
        row.original.serialNumber ? (
          <span className="font-mono text-xs">{row.original.serialNumber}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      accessorKey: 'type',
      header: t('list.columns.type'),
      cell: ({ row }) => (
        <Badge variant="secondary">{tKey(t, `type.${enumKey(row.original.type)}`)}</Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: t('list.columns.status'),
      cell: ({ row }) => <EquipmentStatusBadge status={row.original.status} />,
    },
    {
      id: 'assignee',
      header: t('list.columns.assignee'),
      cell: ({ row }) => <AssigneeCell row={row} unassignedLabel={unassignedLabel} />,
      enableSorting: false,
    },
    {
      id: 'actions',
      header: t('list.columns.actions'),
      cell: ({ row }) => (
        <ActionsCell
          equipment={row.original}
          actions={actions}
          t={t}
          moreActionsLabel={moreActionsLabel}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
    },
  ];
}
