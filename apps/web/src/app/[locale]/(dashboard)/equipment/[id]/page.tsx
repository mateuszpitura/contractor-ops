'use client';

import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { AssignmentDialog } from '@/components/equipment/assignment-dialog';
import { CarrierShipmentForm } from '@/components/equipment/carrier-shipment-form';
import { EquipmentDetailHeader } from '@/components/equipment/equipment-detail/equipment-detail-header';
import { EquipmentDetailTabs } from '@/components/equipment/equipment-detail/equipment-detail-tabs';
import { TabAssignments } from '@/components/equipment/equipment-detail/tab-assignments';
import { TabInfo } from '@/components/equipment/equipment-detail/tab-info';
import { TabShipments } from '@/components/equipment/equipment-detail/tab-shipments';
import { EquipmentForm } from '@/components/equipment/equipment-form';
import { ShipmentForm } from '@/components/equipment/shipment-form';
import { useBreadcrumbOverride } from '@/components/layout/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-[200px]" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-2 border-b pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`skel-${i}`} className="h-7 w-24" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`skel-${i}`} className="rounded-xl border bg-card p-4">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('Equipment');

  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [carrierShipmentOpen, setCarrierShipmentOpen] = useState(false);

  const equipmentQuery = useQuery(trpc.equipment.getById.queryOptions({ id: params.id }));

  const equipment = equipmentQuery.data;

  // Query pending return requests for the current equipment's contractor
  const returnRequestsQuery = useQuery({
    ...trpc.equipment.listReturnRequests.queryOptions({
      status: 'PENDING_APPROVAL',
    }),
    enabled: !!equipment?.currentAssignment,
  });
  const returnRequests = (returnRequestsQuery.data ?? []) as unknown as Array<{
    id: string;
    contractorId: string;
    status: string;
    targetPointName: string | null;
    itemCount: number;
    createdAt: string;
    contractor?: { displayName?: string; legalName?: string };
  }>;

  // Query configured carriers for carrier shipment form
  const courierConfigsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const courierConfigs = (courierConfigsQuery.data ?? []) as unknown as Array<{ carrier: string }>;
  const configuredCarriers = courierConfigs.map(c => c.carrier);

  // Find pending return for current contractor
  const pendingReturn = equipment?.currentAssignment
    ? returnRequests.find(r => r.contractorId === equipment.currentAssignment?.contractorId)
    : null;

  const pendingReturnData = pendingReturn
    ? {
        id: pendingReturn.id,
        contractorName:
          pendingReturn.contractor?.displayName ??
          pendingReturn.contractor?.legalName ??
          equipment?.currentAssignment?.contractor?.displayName ??
          equipment?.currentAssignment?.contractor?.legalName ??
          '',
        itemCount: pendingReturn.itemCount ?? 1,
        targetPointName: pendingReturn.targetPointName ?? '',
        createdAt: pendingReturn.createdAt,
      }
    : null;

  // Breadcrumb override
  useBreadcrumbOverride(params.id, equipment?.name);

  // Error state
  if (equipmentQuery.isError) {
    const isNotFound =
      equipmentQuery.error?.message?.includes('NOT_FOUND') ||
      (equipmentQuery.error as { data?: { code?: string } })?.data?.code === 'NOT_FOUND';

    if (isNotFound) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">Equipment not found</h2>
          <Button variant="outline" render={<Link href="/equipment" />}>
            Back to equipment
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('error.loadFailed')}</h2>
        <Button variant="outline" onClick={() => equipmentQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  // Loading
  if (equipmentQuery.isLoading || !equipment) {
    return <DetailSkeleton />;
  }

  return (
    <div className="space-y-6">
      <EquipmentDetailHeader
        equipment={equipment}
        onEdit={() => setFormOpen(true)}
        onAssign={() => setAssignOpen(true)}
        onCreateShipment={() => setShipmentOpen(true)}
      />

      {configuredCarriers.length > 0 && !equipment.status?.includes('RETIRED') && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCarrierShipmentOpen(true)}>
            <Truck className="me-1.5 size-4" />
            {t('carrier.shipViaCarrier')}
          </Button>
        </div>
      )}

      <Suspense fallback={<DetailSkeleton />}>
        <EquipmentDetailTabs
          infoContent={<TabInfo equipment={equipment} onEdit={() => setFormOpen(true)} />}
          assignmentsContent={
            <TabAssignments
              assignments={equipment.assignments ?? []}
              currentAssignmentId={equipment.currentAssignment?.id ?? null}
            />
          }
          shipmentsContent={
            <TabShipments
              shipments={equipment.shipments ?? []}
              equipmentId={equipment.id}
              onCreateShipment={() => setShipmentOpen(true)}
              pendingReturn={pendingReturnData}
            />
          }
        />
      </Suspense>

      {/* Dialogs */}
      <EquipmentForm open={formOpen} onOpenChange={setFormOpen} equipment={equipment} />

      <AssignmentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        equipmentId={equipment.id}
        equipmentName={equipment.name}
      />

      <ShipmentForm
        open={shipmentOpen}
        onOpenChange={setShipmentOpen}
        equipmentId={equipment.id}
        equipmentName={equipment.name}
      />

      <CarrierShipmentForm
        open={carrierShipmentOpen}
        onOpenChange={setCarrierShipmentOpen}
        equipmentIds={[equipment.id]}
        contractorName={
          equipment.currentAssignment?.contractor?.displayName ??
          equipment.currentAssignment?.contractor?.legalName ??
          ''
        }
        direction="OUTBOUND"
        configuredCarriers={configuredCarriers}
        onSuccess={() => {
          setCarrierShipmentOpen(false);
          equipmentQuery.refetch();
        }}
      />
    </div>
  );
}
