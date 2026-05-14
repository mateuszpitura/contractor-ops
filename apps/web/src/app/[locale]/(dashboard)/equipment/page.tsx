'use client';

import { AtelierEmptyState, AtelierPageHeader, EquipmentIllustration } from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Suspense, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { AssignmentDialog } from '@/components/equipment/assignment-dialog';
import { EquipmentForm } from '@/components/equipment/equipment-form';
import type { EquipmentRow } from '@/components/equipment/equipment-table/equipment-columns';
import { EquipmentTable } from '@/components/equipment/equipment-table/equipment-table';
import { ShipmentForm } from '@/components/equipment/shipment-form';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { PageLoadingSpinner } from '@/components/shared/page-loading-spinner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function EquipmentContent() {
  const t = useTranslations('Equipment');
  const te = useTranslations('EmptyStates');
  const queryClient = useQueryClient();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editEquipment, setEditEquipment] = useState<EquipmentRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<EquipmentRow | null>(null);
  const [shipmentTarget, setShipmentTarget] = useState<EquipmentRow | null>(null);
  const [retireTarget, setRetireTarget] = useState<EquipmentRow | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<EquipmentRow | null>(null);

  // Lightweight count query for empty state detection
  const countQuery = useQuery(trpc.equipment.list.queryOptions({ page: 1, pageSize: 10 }));
  const totalCount = (countQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = countQuery.isLoading;

  const retireMutation = useMutation(
    trpc.equipment.retire.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.retired'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        setRetireTarget(null);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const unassignMutation = useMutation(
    trpc.equipment.unassign.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.unassigned'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        setUnassignTarget(null);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const handleEdit = useCallback((equipment: EquipmentRow) => {
    setEditEquipment(equipment);
    setFormOpen(true);
  }, []);

  const handleAddEquipment = useCallback(() => {
    setEditEquipment(null);
    setFormOpen(true);
  }, []);

  const handleAssign = useCallback((eq: EquipmentRow) => setAssignTarget(eq), []);
  const handleUnassign = useCallback((eq: EquipmentRow) => setUnassignTarget(eq), []);
  const handleCreateShipment = useCallback((eq: EquipmentRow) => setShipmentTarget(eq), []);
  const handleRetire = useCallback((eq: EquipmentRow) => setRetireTarget(eq), []);

  const handleFormOpenChange = useCallback((v: boolean) => {
    setFormOpen(v);
    if (!v) setEditEquipment(null);
  }, []);

  const handleAssignDialogClose = useCallback((v: boolean) => {
    if (!v) setAssignTarget(null);
  }, []);

  const handleShipmentDialogClose = useCallback((v: boolean) => {
    if (!v) setShipmentTarget(null);
  }, []);

  const handleRetireDialogClose = useCallback((v: boolean) => {
    if (!v) setRetireTarget(null);
  }, []);

  const handleUnassignDialogClose = useCallback((v: boolean) => {
    if (!v) setUnassignTarget(null);
  }, []);

  const handleCancelRetire = useCallback(() => setRetireTarget(null), []);
  const handleConfirmRetire = useCallback(
    () => retireTarget && retireMutation.mutate({ id: retireTarget.id }),
    [retireTarget, retireMutation],
  );

  const handleCancelUnassign = useCallback(() => setUnassignTarget(null), []);
  const handleConfirmUnassign = useCallback(
    () => unassignTarget && unassignMutation.mutate({ equipmentId: unassignTarget.id }),
    [unassignTarget, unassignMutation],
  );

  // Atelier full-page empty state only after count resolves AND there's truly
  // zero data. While count is in flight, fall through to the populated
  // branch — EquipmentTable renders its real chrome and DataTableBody shows
  // skeleton rows. `parentLoading` is forwarded to prevent an in-table empty
  // flash before the swap to Atelier.
  if (!isCountLoading && totalCount === 0) {
    return (
      <div className="space-y-6">
        <AnimateIn delay={0}>
          <AtelierPageHeader title={t('title')} description={t('pageDescription')} />
        </AnimateIn>
        <AnimateIn delay={1}>
          <AtelierEmptyState
            illustration={EquipmentIllustration}
            heading={te('equipment.heading')}
            body={te('equipment.body')}
            primaryAction={{ label: te('equipment.cta'), onClick: handleAddEquipment }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
        <EquipmentForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          equipment={editEquipment}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('title')} description={t('pageDescription')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <EquipmentTable
          onEdit={handleEdit}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onCreateShipment={handleCreateShipment}
          onRetire={handleRetire}
          onAddEquipment={handleAddEquipment}
          parentLoading={isCountLoading}
        />
      </AnimateIn>

      {/* Create/Edit form dialog */}
      <EquipmentForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        equipment={editEquipment}
      />

      {/* Assignment dialog */}
      {!!assignTarget && (
        <AssignmentDialog
          open={!!assignTarget}
          onOpenChange={handleAssignDialogClose}
          equipmentId={assignTarget.id}
          equipmentName={assignTarget.name}
        />
      )}

      {/* Shipment form dialog */}
      {!!shipmentTarget && (
        <ShipmentForm
          open={!!shipmentTarget}
          onOpenChange={handleShipmentDialogClose}
          equipmentId={shipmentTarget.id}
          equipmentName={shipmentTarget.name}
        />
      )}

      {/* Retire confirmation */}
      <Dialog open={!!retireTarget} onOpenChange={handleRetireDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.retireConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('detail.retireConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelRetire}
              disabled={retireMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRetire}
              disabled={retireMutation.isPending}>
              {t('detail.retire')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign confirmation */}
      <Dialog open={!!unassignTarget} onOpenChange={handleUnassignDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.unassignConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('detail.unassignConfirmDescription', {
                contractorName: unassignTarget?.currentAssignment?.contractorName ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelUnassign}
              disabled={unassignMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmUnassign}
              disabled={unassignMutation.isPending}>
              {t('detail.unassignEquipment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EquipmentPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EquipmentContent />
    </Suspense>
  );
}
