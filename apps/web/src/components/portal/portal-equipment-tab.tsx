'use client';

import { AtelierEmptyState, EquipmentIllustration } from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge';
import { EquipmentTypeIcon } from '@/components/equipment/equipment-type-icon';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { portalTrpc } from '@/trpc/init';
import { PortalReturnFlow } from './portal-return-flow';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Contractor portal Equipment tab.
 * Shows assigned equipment with status badges and return button.
 * Displays return request status banner when applicable.
 */
export function PortalEquipmentTab() {
  const t = useTranslations('Portal.equipment');
  const tReturn = useTranslations('Portal.return');
  const queryClient = useQueryClient();
  const [returnFlowOpen, setReturnFlowOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const equipmentQuery = useQuery(portalTrpc.portal.listEquipment.queryOptions());
  const equipment = (equipmentQuery.data ?? []) as unknown as Array<{
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
      currentStatus: string;
      deliveredAt: string | null;
    } | null;
  }>;

  const returnStatusQuery = useQuery(portalTrpc.portal.getReturnStatus.queryOptions());
  const returnRequest = returnStatusQuery.data as unknown as {
    id: string;
    status: string;
    shipmentId: string | null;
    targetPointName: string | null;
  } | null;

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const cancelMutation = useMutation(
    portalTrpc.portal.cancelReturn.mutationOptions({
      onSuccess: () => {
        toast.success(tReturn('cancelledToast'));
        setCancelDialogOpen(false);
        queryClient.invalidateQueries({
          queryKey: portalTrpc.portal.getReturnStatus.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: portalTrpc.portal.listEquipment.queryKey(),
        });
      },
      onError: () => {
        toast.error(tReturn('cancelledToast'));
      },
    }),
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (equipmentQuery.isPending) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <Skeleton className="h-9 w-32" />
        </div>
        {/* Equipment card skeletons mirror final layout: icon + name+badge / serial+delivered */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              key={`skel-${i}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-6 w-6 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  if (equipment.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <AtelierEmptyState
          variant="subview"
          illustration={EquipmentIllustration}
          heading={t('emptyTitle')}
          body={t('emptyDescription')}
          renderAction={renderEmptyStateAction}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Can return check
  // -------------------------------------------------------------------------

  const canReturn = equipment.some(
    item => item.equipment.status === 'ASSIGNED' || item.equipment.status === 'DELIVERED',
  );

  const returnableItems = equipment
    .filter(item => item.equipment.status === 'ASSIGNED' || item.equipment.status === 'DELIVERED')
    .map(item => ({
      name: item.equipment.name,
      serialNumber: item.equipment.serialNumber,
    }));

  const hasActiveReturn =
    returnRequest &&
    (returnRequest.status === 'PENDING_APPROVAL' || returnRequest.status === 'SHIPMENT_CREATED');

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        {canReturn && !hasActiveReturn && (
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          <Button onClick={() => setReturnFlowOpen(true)}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" />
            {t('returnAll')}
          </Button>
        )}
      </div>

      {/* Return status banner */}
      {returnRequest?.status === 'PENDING_APPROVAL' && (
        <div className="rounded-md border-s-4 border-warning bg-warning/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('pendingApproval')}</p>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)}>
              {t('cancelReturn')}
            </Button>
          </div>
        </div>
      )}

      {returnRequest?.status === 'SHIPMENT_CREATED' && (
        <div className="rounded-md border-s-4 border-primary bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('returnApproved')}</p>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <Button size="sm" onClick={() => setReturnFlowOpen(true)}>
              {t('viewLabel')}
            </Button>
          </div>
        </div>
      )}

      {/* Equipment cards */}
      <div className="space-y-3">
        {equipment.map(item => (
          <Card key={item.assignmentId}>
            <CardContent className="flex items-center gap-4 p-4">
              <EquipmentTypeIcon type={item.equipment.type} className="h-6 w-6" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.equipment.name}</span>
                  <EquipmentStatusBadge status={item.equipment.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {!!item.equipment.serialNumber && (
                    <span className="font-mono">{item.equipment.serialNumber}</span>
                  )}
                  {!!item.latestShipment?.deliveredAt && (
                    <span>
                      {t('deliveredOn', {
                        date: format(new Date(item.latestShipment.deliveredAt), 'MMM d, yyyy'),
                      })}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Return flow dialog */}
      <PortalReturnFlow
        open={returnFlowOpen}
        onOpenChange={setReturnFlowOpen}
        equipmentItems={returnableItems}
        returnRequest={returnRequest}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: portalTrpc.portal.getReturnStatus.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: portalTrpc.portal.listEquipment.queryKey(),
          });
        }}
      />

      {/* Cancel return confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tReturn('cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tReturn('cancelConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              {tReturn('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                if (returnRequest) {
                  cancelMutation.mutate({ id: returnRequest.id });
                }
              }}
              disabled={cancelMutation.isPending}>
              {!!cancelMutation.isPending && (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {tReturn('cancelConfirmTitle')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
