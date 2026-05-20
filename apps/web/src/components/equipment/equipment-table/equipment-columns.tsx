'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { ColumnDef } from '@tanstack/react-table';
import { Archive, MoreHorizontal, Pencil, Truck, UserMinus, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { TranslatorOf } from '@/i18n/typed-keys';
import { tKey } from '@/i18n/typed-keys';
import { enumKey } from '@/lib/enum-key';
import { EquipmentStatusBadge } from '../equipment-status-badge';
import { EquipmentTypeIcon } from '../equipment-type-icon';

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

type TranslateFunction = TranslatorOf<'Equipment'>;

interface ColumnActions {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
}

export function getEquipmentColumns(
  t: TranslateFunction,
  tCommon: TranslatorOf<'Common'>,
  actions: ColumnActions,
): ColumnDef<EquipmentRow>[] {
  return [
    // 1. Name with type icon
    {
      accessorKey: 'name',
      header: t('list.columns.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[180px]">
          <EquipmentTypeIcon type={row.original.type} />
          <Link
            href={`/equipment/${row.original.id}`}
            className="font-medium hover:underline"
            // biome-ignore lint/nursery/noJsxPropsBind: column definition
            onClick={e => e.stopPropagation()}>
            {row.original.name}
          </Link>
        </div>
      ),
      enableHiding: false,
    },

    // 2. Serial number
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

    // 3. Type
    {
      accessorKey: 'type',
      header: t('list.columns.type'),
      cell: ({ row }) => (
        <Badge variant="secondary">{tKey(t, `type.${enumKey(row.original.type)}` as string)}</Badge>
      ),
    },

    // 4. Status
    {
      accessorKey: 'status',
      header: t('list.columns.status'),
      cell: ({ row }) => <EquipmentStatusBadge status={row.original.status} />,
    },

    // 5. Assignee
    {
      id: 'assignee',
      header: t('list.columns.assignee'),
      cell: ({ row }) => {
        const assignment = row.original.currentAssignment;
        if (!assignment) {
          return <span className="text-muted-foreground text-sm">{t('list.unassigned')}</span>;
        }
        return (
          <Link
            href={`/contractors/${assignment.contractorId}`}
            className="text-sm hover:underline"
            // biome-ignore lint/nursery/noJsxPropsBind: column definition
            onClick={e => e.stopPropagation()}>
            {assignment.contractorName ?? assignment.contractorId}
          </Link>
        );
      },
      enableSorting: false,
    },

    // 6. Actions
    {
      id: 'actions',
      header: t('list.columns.actions'),
      cell: ({ row }) => {
        const equipment = row.original;
        const isAssigned = equipment.status === 'ASSIGNED';
        const isRetired = equipment.status === 'RETIRED';

        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: column definition
              render={props => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  // biome-ignore lint/nursery/noJsxPropsBind: column definition
                  onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{tCommon('srOnly.moreActions')}</span>
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {/* biome-ignore lint/nursery/noJsxPropsBind: column definition */}
              <DropdownMenuItem onSelect={() => actions.onEdit(equipment)}>
                <Pencil className="me-2 h-3.5 w-3.5" />
                {t('detail.edit')}
              </DropdownMenuItem>
              {!(isRetired || isAssigned) && (
                // biome-ignore lint/nursery/noJsxPropsBind: column definition
                <DropdownMenuItem onSelect={() => actions.onAssign(equipment)}>
                  <UserPlus className="me-2 h-3.5 w-3.5" />
                  {t('detail.assignToContractor')}
                </DropdownMenuItem>
              )}
              {isAssigned && (
                // biome-ignore lint/nursery/noJsxPropsBind: column definition
                <DropdownMenuItem onSelect={() => actions.onUnassign(equipment)}>
                  <UserMinus className="me-2 h-3.5 w-3.5" />
                  {t('detail.unassignEquipment')}
                </DropdownMenuItem>
              )}
              {!isRetired && (
                // biome-ignore lint/nursery/noJsxPropsBind: column definition
                <DropdownMenuItem onSelect={() => actions.onCreateShipment(equipment)}>
                  <Truck className="me-2 h-3.5 w-3.5" />
                  {t('detail.createShipment')}
                </DropdownMenuItem>
              )}
              {!isRetired && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    // biome-ignore lint/nursery/noJsxPropsBind: column definition
                    onSelect={() => actions.onRetire(equipment)}>
                    <Archive className="me-2 h-3.5 w-3.5" />
                    {t('detail.retire')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 50,
    },
  ];
}
