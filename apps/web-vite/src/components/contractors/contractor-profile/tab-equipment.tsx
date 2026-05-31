import {
  AtelierEmptyState,
  DataTable,
  EquipmentIllustration,
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
} from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Package } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { EquipmentStatusBadge } from '../../equipment/equipment-status-badge.js';
import { EquipmentTypeIcon } from '../../equipment/equipment-type-icon.js';
import { ShipmentCondensed } from '../../equipment/shipment-condensed.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
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

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

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

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const getRowId = useCallback((row: ContractorTabEquipmentItem) => row.assignmentId, []);

  return (
    <div className={WORKBENCH_DATA_TABLE_CLASS}>
      <SectionLabel icon={Package}>{t('contractorTab.tabLabel')}</SectionLabel>
      <DataTable
        columns={columns}
        data={items}
        totalRows={items.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={handlePageSizeChange}
        isLoading={isLoading}
        isRefetching={isFetching && !isLoading}
        constrainHeight={false}
        hideDensityToggle
        getRowId={getRowId}
        entityLabel={t('entityLabel', { count: items.length })}
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
    </div>
  );
}
