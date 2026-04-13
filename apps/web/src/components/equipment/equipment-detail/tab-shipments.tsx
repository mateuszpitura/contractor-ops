'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Trash2, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/trpc/init';
import { ReturnApprovalBanner } from '../return-approval-banner';
import { ShipmentStatusBadge } from '../shipment-status-badge';
import { ShipmentTimeline } from '../shipment-timeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShipmentEvent {
  id: string;
  status: string;
  notes: string | null;
  occurredAt: string;
  createdByUserId: string | null;
}

interface Shipment {
  id: string;
  direction: string;
  carrier: string;
  carrierCustom: string | null;
  trackingNumber: string | null;
  currentStatus: string;
  expectedDeliveryAt: string | null;
  createdAt: string;
  events: ShipmentEvent[];
}

interface PendingReturn {
  id: string;
  contractorName: string;
  itemCount: number;
  targetPointName: string;
  createdAt: string;
}

interface TabShipmentsProps {
  shipments: Shipment[];
  equipmentId: string;
  onCreateShipment: () => void;
  pendingReturn?: PendingReturn | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabShipments({
  shipments,
  equipmentId: _equipmentId,
  onCreateShipment,
  pendingReturn,
}: TabShipmentsProps) {
  const t = useTranslations('Equipment');
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const deleteMutation = useMutation(
    trpc.equipment.deleteShipment.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.shipmentDeleted'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  if (shipments.length === 0) {
    return (
      <div className="space-y-4">
        {!!pendingReturn && <ReturnApprovalBanner returnRequest={pendingReturn} />}
        <div className="flex justify-end">
          <Button onClick={onCreateShipment}>
            <Truck className="me-1.5 size-3.5" />
            {t('detail.createShipment')}
          </Button>
        </div>
        <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <Truck className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-[16px] font-medium">{t('detail.shipmentsEmpty')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('detail.shipmentsEmptyDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!!pendingReturn && <ReturnApprovalBanner returnRequest={pendingReturn} />}
      <div className="flex justify-end">
        <Button onClick={onCreateShipment}>
          <Truck className="me-1.5 size-3.5" />
          {t('detail.createShipment')}
        </Button>
      </div>

      {shipments.map(shipment => (
        <Card key={shipment.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {shipment.direction === 'OUTBOUND'
                    ? t('shipment.outbound')
                    : t('shipment.return')}
                </CardTitle>
                <ShipmentStatusBadge status={shipment.currentStatus} />
                <span className="text-sm text-muted-foreground">{shipment.carrier}</span>
                {!!shipment.trackingNumber && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {shipment.trackingNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(shipment.createdAt), 'MMM d, yyyy')}
                </span>
                {shipment.currentStatus === 'CREATED' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(shipment.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ShipmentTimeline
              shipmentId={shipment.id}
              currentStatus={shipment.currentStatus}
              events={shipment.events}
              direction={shipment.direction}
            />
          </CardContent>
        </Card>
      ))}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('shipment.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('shipment.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget })}
              disabled={deleteMutation.isPending}>
              {t('shipment.deleteTitle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
