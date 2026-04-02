"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, UserPlus, UserMinus, Truck, Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EquipmentTypeIcon } from "../equipment-type-icon";
import { EquipmentStatusBadge } from "../equipment-status-badge";
import { Link } from "@/i18n/navigation";

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

type TranslateFunction = (key: string) => string;

interface ColumnActions {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
}

export function getEquipmentColumns(
  t: TranslateFunction,
  tCommon: TranslateFunction,
  actions: ColumnActions,
): ColumnDef<EquipmentRow>[] {
  return [
    // 1. Name with type icon
    {
      accessorKey: "name",
      header: t("list.columns.name"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[180px]">
          <EquipmentTypeIcon type={row.original.type} />
          <Link
            href={`/equipment/${row.original.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.name}
          </Link>
        </div>
      ),
      enableHiding: false,
    },

    // 2. Serial number
    {
      accessorKey: "serialNumber",
      header: t("list.columns.serialNumber"),
      cell: ({ row }) =>
        row.original.serialNumber ? (
          <span className="font-mono text-xs">{row.original.serialNumber}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },

    // 3. Type
    {
      accessorKey: "type",
      header: t("list.columns.type"),
      cell: ({ row }) => (
        <Badge variant="secondary">
          {t(`type.${row.original.type}` as string)}
        </Badge>
      ),
    },

    // 4. Status
    {
      accessorKey: "status",
      header: t("list.columns.status"),
      cell: ({ row }) => <EquipmentStatusBadge status={row.original.status} />,
    },

    // 5. Assignee
    {
      id: "assignee",
      header: t("list.columns.assignee"),
      cell: ({ row }) => {
        const assignment = row.original.currentAssignment;
        if (!assignment) {
          return (
            <span className="text-muted-foreground text-sm">
              {t("list.unassigned")}
            </span>
          );
        }
        return (
          <Link
            href={`/contractors/${assignment.contractorId}`}
            className="text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {assignment.contractorName ?? assignment.contractorId}
          </Link>
        );
      },
      enableSorting: false,
    },

    // 6. Actions
    {
      id: "actions",
      header: t("list.columns.actions"),
      cell: ({ row }) => {
        const equipment = row.original;
        const isAssigned = equipment.status === "ASSIGNED";
        const isRetired = equipment.status === "RETIRED";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{tCommon("srOnly.moreActions")}</span>
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => actions.onEdit(equipment)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                {t("detail.edit")}
              </DropdownMenuItem>
              {!isRetired && !isAssigned && (
                <DropdownMenuItem onSelect={() => actions.onAssign(equipment)}>
                  <UserPlus className="mr-2 h-3.5 w-3.5" />
                  {t("detail.assignToContractor")}
                </DropdownMenuItem>
              )}
              {isAssigned && (
                <DropdownMenuItem onSelect={() => actions.onUnassign(equipment)}>
                  <UserMinus className="mr-2 h-3.5 w-3.5" />
                  {t("detail.unassignEquipment")}
                </DropdownMenuItem>
              )}
              {!isRetired && (
                <DropdownMenuItem
                  onSelect={() => actions.onCreateShipment(equipment)}
                >
                  <Truck className="mr-2 h-3.5 w-3.5" />
                  {t("detail.createShipment")}
                </DropdownMenuItem>
              )}
              {!isRetired && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => actions.onRetire(equipment)}
                  >
                    <Archive className="mr-2 h-3.5 w-3.5" />
                    {t("detail.retire")}
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
