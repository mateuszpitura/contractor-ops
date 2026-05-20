'use client';

import {
  AtelierEmptyState,
  AtelierTableShell,
  EquipmentIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge';
import { EquipmentTypeIcon } from '@/components/equipment/equipment-type-icon';
import { ShipmentCondensed } from '@/components/equipment/shipment-condensed';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { DataTableBody } from '@/components/shared/data-table-body';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TabEquipmentProps {
  contractorId: string;
}

type EquipmentItem = {
  assignmentId: string;
  assignedAt: string;
  equipment: {
    id: string;
    name: string;
    serialNumber: string | null;
    type: string;
    status: string;
  };
  latestShipment: {
    id: string;
    carrier: string;
    currentStatus: string;
    trackingNumber: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabEquipment({ contractorId }: TabEquipmentProps) {
  const t = useTranslations('Equipment');

  const query = useQuery(trpc.equipment.listByContractor.queryOptions({ contractorId }));
  const items = (query.data ?? []) as unknown as EquipmentItem[];

  const columns: ColumnDef<EquipmentItem>[] = useMemo(
    () => [
      {
        id: 'name',
        header: () => t('list.columns.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <EquipmentTypeIcon type={row.original.equipment.type} />
            <Link
              href={`/equipment/${row.original.equipment.id}`}
              className="font-medium hover:underline">
              {row.original.equipment.name}
            </Link>
          </div>
        ),
      },
      {
        id: 'serialNumber',
        header: () => t('list.columns.serialNumber'),
        cell: ({ row }) =>
          row.original.equipment.serialNumber ? (
            <span className="font-mono text-xs">{row.original.equipment.serialNumber}</span>
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          ),
      },
      {
        id: 'status',
        header: () => t('list.columns.status'),
        cell: ({ row }) => <EquipmentStatusBadge status={row.original.equipment.status} />,
      },
      {
        id: 'shipment',
        header: () => 'Shipment',
        cell: ({ row }) => <ShipmentCondensed shipment={row.original.latestShipment} />,
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => row.assignmentId,
  });

  const isLoading = query.isLoading;

  if (!isLoading && items.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel icon={Package}>{t('contractorTab.tabLabel')}</SectionLabel>
        <AtelierEmptyState
          variant="subview"
          illustration={EquipmentIllustration}
          heading={t('contractorTab.emptyTitle')}
          body={t('contractorTab.emptyDescription')}
          renderAction={renderEmptyStateAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionLabel icon={Package}>{t('contractorTab.tabLabel')}</SectionLabel>
      <AtelierTableShell isLoading={query.isFetching && !query.isLoading}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading}
            hasFiltersOrSearch={false}
            emptyIcon={<Package className="h-5 w-5" />}
            emptyTitle={t('contractorTab.emptyTitle')}
            emptyDescription={t('contractorTab.emptyDescription')}
            noResultsTitle={t('contractorTab.emptyTitle')}
            skeletonRows={5}
            skeletonColumns={{
              name: { shape: 'text', width: 'w-40' },
              serialNumber: { shape: 'text', width: 'w-28' },
              status: { shape: 'badge' },
              shipment: { shape: 'text', width: 'w-32' },
            }}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}
