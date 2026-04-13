'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const shipmentFormSchema = z.object({
  direction: z.enum(['OUTBOUND', 'RETURN']),
  carrier: z.string().min(1, 'Carrier is required'),
  carrierCustom: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  expectedDeliveryAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

const CARRIERS = ['InPost', 'DPD', 'UPS', 'Other'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShipmentForm({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
}: ShipmentFormProps) {
  const t = useTranslations('Equipment');
  const queryClient = useQueryClient();

  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      direction: 'OUTBOUND',
      carrier: 'InPost',
      carrierCustom: '',
      trackingNumber: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        direction: 'OUTBOUND',
        carrier: 'InPost',
        carrierCustom: '',
        trackingNumber: '',
        notes: '',
      });
    }
  }, [open, form]);

  const createMutation = useMutation(
    trpc.equipment.createShipment.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.shipmentCreated'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const onSubmit = form.handleSubmit(data => {
    createMutation.mutate({
      equipmentId,
      direction: data.direction,
      carrier: data.carrier === 'Other' ? (data.carrierCustom ?? 'Other') : data.carrier,
      carrierCustom: data.carrier === 'Other' ? data.carrierCustom : undefined,
      trackingNumber: data.trackingNumber || undefined,
      expectedDeliveryAt: data.expectedDeliveryAt || undefined,
      notes: data.notes || undefined,
    });
  });

  const watchedCarrier = form.watch('carrier');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shipment.createTitle')}</DialogTitle>
          <DialogDescription>{equipmentName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Direction */}
          <div className="space-y-2">
            <Label>{t('shipment.direction')}</Label>
            <Select
              value={form.watch('direction')}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onValueChange={val =>
                val && form.setValue('direction', val as 'OUTBOUND' | 'RETURN')
              }>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OUTBOUND">{t('shipment.outbound')}</SelectItem>
                <SelectItem value="RETURN">{t('shipment.return')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Carrier */}
          <div className="space-y-2">
            <Label>{t('shipment.carrier')}</Label>
            <Select
              value={watchedCarrier}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onValueChange={val => val && form.setValue('carrier', val)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map(carrier => (
                  <SelectItem key={carrier} value={carrier}>
                    {carrier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom carrier name */}
          {watchedCarrier === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="shipment-carrier-custom">{t('shipment.carrierCustom')}</Label>
              <Input id="shipment-carrier-custom" {...form.register('carrierCustom')} />
            </div>
          )}

          {/* Tracking number */}
          <div className="space-y-2">
            <Label htmlFor="shipment-tracking">{t('shipment.trackingNumber')}</Label>
            <Input
              id="shipment-tracking"
              className="font-mono"
              {...form.register('trackingNumber')}
            />
          </div>

          {/* Expected delivery */}
          <div className="space-y-2">
            <Label htmlFor="shipment-expected-delivery">{t('shipment.expectedDelivery')}</Label>
            <Input
              id="shipment-expected-delivery"
              type="date"
              {...form.register('expectedDeliveryAt', {
                setValueAs: (v: string) => (v ? new Date(v) : undefined),
              })}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="shipment-notes">{t('shipment.notes')}</Label>
            <Textarea id="shipment-notes" rows={2} {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {!!createMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('shipment.createTitle')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
