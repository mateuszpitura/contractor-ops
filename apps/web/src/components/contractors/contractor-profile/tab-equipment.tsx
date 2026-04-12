'use client';

import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge';
import { EquipmentTypeIcon } from '@/components/equipment/equipment-type-icon';
import { ShipmentCondensed } from '@/components/equipment/shipment-condensed';
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

  // Loading state
  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skel-${i}`} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <Package className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-[16px] font-medium">{t('contractorTab.emptyTitle')}</h3>
        <p className="mt-1 max-w-[420px] text-sm text-muted-foreground">
          {t('contractorTab.emptyDescription')}
        </p>
      </div>
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
          {items.map(item => (
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
