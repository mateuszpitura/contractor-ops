/**
 * Equipment detail — route shell with inlined page content.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Truck } from 'lucide-react';
import { Suspense, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { AssignmentDialog } from '../../components/equipment/assignment-dialog.js';
import { CarrierShipmentForm } from '../../components/equipment/carrier-shipment-form.js';
import { EquipmentDetailHeader } from '../../components/equipment/equipment-detail/equipment-detail-header.js';
import { EquipmentDetailTabs } from '../../components/equipment/equipment-detail/equipment-detail-tabs.js';
import { TabAssignments } from '../../components/equipment/equipment-detail/tab-assignments.js';
import { TabInfo } from '../../components/equipment/equipment-detail/tab-info.js';
import { TabShipments } from '../../components/equipment/equipment-detail/tab-shipments.js';
import { EquipmentForm } from '../../components/equipment/equipment-form.js';
import { useEquipmentDetail } from '../../components/equipment/hooks/use-equipment-detail.js';
import { ShipmentForm } from '../../components/equipment/shipment-form.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

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
          <div key={`skel-card-${i}`} className="rounded-xl border bg-card p-4">
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

function EquipmentDetailPageContent() {
  const params = useParams<{ id: string }>();
  const equipmentId = params.id ?? '';
  const t = useTranslations('Equipment');
  const {
    equipment,
    pendingReturnData,
    formOpen,
    setFormOpen,
    assignOpen,
    setAssignOpen,
    shipmentOpen,
    setShipmentOpen,
    handleRetry,
    isNotFound,
    isError,
    isLoading,
    configuredCarriers,
  } = useEquipmentDetail(equipmentId);

  const [carrierShipmentOpen, setCarrierShipmentOpen] = useState(false);

  const handleOpenForm = useCallback(() => setFormOpen(true), [setFormOpen]);
  const handleOpenAssign = useCallback(() => setAssignOpen(true), [setAssignOpen]);
  const handleOpenShipment = useCallback(() => setShipmentOpen(true), [setShipmentOpen]);
  const handleOpenCarrierShipment = useCallback(() => setCarrierShipmentOpen(true), []);
  const handleCarrierShipmentSuccess = useCallback(() => {
    setCarrierShipmentOpen(false);
  }, []);

  if (isError) {
    if (isNotFound) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">{t('detail.notFound')}</h2>
          <Button variant="outline" render={<Link href="/equipment" />}>
            {t('detail.backToList')}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('error.loadFailed')}</h2>
        <Button variant="outline" onClick={handleRetry}>
          {t('detail.retry')}
        </Button>
      </div>
    );
  }

  if (isLoading || !equipment) {
    return <DetailSkeleton />;
  }

  return (
    <div className="space-y-section-gap">
      <EquipmentDetailHeader
        equipment={equipment}
        onEdit={handleOpenForm}
        onAssign={handleOpenAssign}
        onCreateShipment={handleOpenShipment}
      />

      {configuredCarriers.length > 0 && !equipment.status?.includes('RETIRED') && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenCarrierShipment}>
            <Truck className="me-1.5 size-4" />
            {t('carrier.shipViaCarrier')}
          </Button>
        </div>
      )}

      <Suspense fallback={<DetailSkeleton />}>
        <EquipmentDetailTabs
          infoContent={<TabInfo equipment={equipment} onEdit={handleOpenForm} />}
          assignmentsContent={
            <TabAssignments
              assignments={equipment.assignments ?? []}
              currentAssignmentId={equipment.currentAssignment?.id ?? null}
            />
          }
          shipmentsContent={
            <TabShipments
              equipmentId={equipment.id}
              onCreateShipment={handleOpenShipment}
              pendingReturn={pendingReturnData}
            />
          }
        />
      </Suspense>

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
        onSuccess={handleCarrierShipmentSuccess}
      />
    </div>
  );
}

export default function EquipmentDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EquipmentDetailPageContent />
    </Suspense>
  );
}
