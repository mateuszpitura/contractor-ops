'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { AssignmentDialog } from '@/components/equipment/assignment-dialog';
import { EquipmentForm } from '@/components/equipment/equipment-form';
import type { EquipmentRow } from '@/components/equipment/equipment-table/equipment-columns';
import { EquipmentTable } from '@/components/equipment/equipment-table/equipment-table';
import { ShipmentForm } from '@/components/equipment/shipment-form';
import { AnimateIn } from '@/components/shared/animate-in';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function EquipmentContent() {
  const t = useTranslations('Equipment');
  const queryClient = useQueryClient();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editEquipment, setEditEquipment] = useState<EquipmentRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<EquipmentRow | null>(null);
  const [shipmentTarget, setShipmentTarget] = useState<EquipmentRow | null>(null);
  const [retireTarget, setRetireTarget] = useState<EquipmentRow | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<EquipmentRow | null>(null);

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

  const handleEdit = (equipment: EquipmentRow) => {
    setEditEquipment(equipment);
    setFormOpen(true);
  };

  const handleAddEquipment = () => {
    setEditEquipment(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <PageHeader title={t('title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <EquipmentTable
          onEdit={handleEdit}
          onAssign={eq => setAssignTarget(eq)}
          onUnassign={eq => setUnassignTarget(eq)}
          onCreateShipment={eq => setShipmentTarget(eq)}
          onRetire={eq => setRetireTarget(eq)}
          onAddEquipment={handleAddEquipment}
        />
      </AnimateIn>

      {/* Create/Edit form dialog */}
      <EquipmentForm
        open={formOpen}
        onOpenChange={v => {
          setFormOpen(v);
          if (!v) setEditEquipment(null);
        }}
        equipment={editEquipment}
      />

      {/* Assignment dialog */}
      {assignTarget && (
        <AssignmentDialog
          open={!!assignTarget}
          onOpenChange={v => !v && setAssignTarget(null)}
          equipmentId={assignTarget.id}
          equipmentName={assignTarget.name}
        />
      )}

      {/* Shipment form dialog */}
      {shipmentTarget && (
        <ShipmentForm
          open={!!shipmentTarget}
          onOpenChange={v => !v && setShipmentTarget(null)}
          equipmentId={shipmentTarget.id}
          equipmentName={shipmentTarget.name}
        />
      )}

      {/* Retire confirmation */}
      <Dialog open={!!retireTarget} onOpenChange={v => !v && setRetireTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.retireConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('detail.retireConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRetireTarget(null)}
              disabled={retireMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => retireTarget && retireMutation.mutate({ id: retireTarget.id })}
              disabled={retireMutation.isPending}>
              {t('detail.retire')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign confirmation */}
      <Dialog open={!!unassignTarget} onOpenChange={v => !v && setUnassignTarget(null)}>
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
              onClick={() => setUnassignTarget(null)}
              disabled={unassignMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                unassignTarget && unassignMutation.mutate({ equipmentId: unassignTarget.id })
              }
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
// Loading fallback
// ---------------------------------------------------------------------------

function EquipmentLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="rounded-xl border bg-background">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EquipmentPage() {
  return (
    <Suspense fallback={<EquipmentLoading />}>
      <EquipmentContent />
    </Suspense>
  );
}
