'use client';

import { AtelierEmptyState, EquipmentIllustration } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge';
import { EquipmentTypeIcon } from '@/components/equipment/equipment-type-icon';
import { ShipmentCondensed } from '@/components/equipment/shipment-condensed';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

/**
 * Equipment tab content for contractor profile.
 * Shows equipment assigned to this contractor with condensed shipment status.
 */
export function TabEquipment({ contractorId }: TabEquipmentProps) {
  const t = useTranslations('Equipment');

  const query = useQuery(trpc.equipment.listByContractor.queryOptions({ contractorId }));

  const items = (query.data ?? []) as unknown as EquipmentItem[];
  const isLoading = query.isLoading;

  // Empty state only when fully loaded and truly empty
  if (!isLoading && items.length === 0) {
    return (
      <AtelierEmptyState
        variant="subview"
        illustration={EquipmentIllustration}
        heading={t('contractorTab.emptyTitle')}
        body={t('contractorTab.emptyDescription')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.columns.name')}</TableHead>
            <TableHead>{t('list.columns.serialNumber')}</TableHead>
            <TableHead>{t('list.columns.status')}</TableHead>
            <TableHead>Shipment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-full max-w-[160px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </TableCell>
                </TableRow>
              ))
            : items.map(item => (
                <TableRow key={item.assignmentId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EquipmentTypeIcon type={item.equipment.type} />
                      <Link
                        href={`/equipment/${item.equipment.id}`}
                        className="font-medium hover:underline">
                        {item.equipment.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.equipment.serialNumber ? (
                      <span className="font-mono text-xs">{item.equipment.serialNumber}</span>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <EquipmentStatusBadge status={item.equipment.status} />
                  </TableCell>
                  <TableCell>
                    <ShipmentCondensed shipment={item.latestShipment} />
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
