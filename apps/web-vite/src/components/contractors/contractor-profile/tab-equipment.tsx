import {
  AtelierEmptyState,
  AtelierTableShell,
  EquipmentIllustration,
  SectionLabel,
  TableChrome,
  WORKBENCH_DATA_TABLE_CLASS,
} from '@contractor-ops/ui';
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Package } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { EquipmentStatusBadge } from '../../equipment/equipment-status-badge.js';
import { EquipmentTypeIcon } from '../../equipment/equipment-type-icon.js';
import { ShipmentCondensed } from '../../equipment/shipment-condensed.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { DataTableBody } from '../../shared/data-table-body.js';
import type {
  ContractorTabEquipmentItem,
  useContractorTabEquipment,
} from '../hooks/use-contractor-tab-equipment.js';

type TabEquipmentViewProps = {
  contractorId: string;
} & ReturnType<typeof useContractorTabEquipment>;

export function TabEquipmentEmpty() {
  const t = useTranslations('Equipment');
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

export function TabEquipmentView({ items, isLoading, isFetching }: TabEquipmentViewProps) {
  const t = useTranslations('Equipment');
  const tAria = useTranslations('Common.aria');

  const columns: ColumnDef<ContractorTabEquipmentItem>[] = useMemo(
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

  return (
    <div className={WORKBENCH_DATA_TABLE_CLASS}>
      <SectionLabel icon={Package}>{t('contractorTab.tabLabel')}</SectionLabel>
      <AtelierTableShell
        isLoading={isFetching && !isLoading}
        chrome={
          <TableChrome
            totalCount={items.length}
            entityLabel={t('entityLabel', { count: items.length })}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }>
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
