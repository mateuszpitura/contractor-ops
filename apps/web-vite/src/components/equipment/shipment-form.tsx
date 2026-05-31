import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { useEquipmentShipmentForm } from './hooks/use-equipment-shipment-form.js';

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

export interface ShipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentName: string;
}

type ShipmentFormViewProps = ShipmentFormProps &
  Pick<ReturnType<typeof useEquipmentShipmentForm>, 'createMutation' | 'isPending'>;

export function ShipmentFormView({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
  createMutation,
  isPending,
}: ShipmentFormViewProps) {
  const id = useId();
  const t = useTranslations('Equipment');

  const form = useForm<z.input<typeof shipmentFormSchema>, unknown, ShipmentFormValues>({
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

  const handleDirectionChange = useCallback(
    (val: unknown) => {
      if (val) form.setValue('direction', val as 'OUTBOUND' | 'RETURN');
    },
    [form],
  );
  const handleCarrierChange = useCallback(
    (val: unknown) => {
      if (val) form.setValue('carrier', val as string);
    },
    [form],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shipment.createTitle')}</DialogTitle>
          <DialogDescription>{equipmentName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>{t('shipment.direction')}</Label>
              <Select value={form.watch('direction')} onValueChange={handleDirectionChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTBOUND">{t('shipment.outbound')}</SelectItem>
                  <SelectItem value="RETURN">{t('shipment.return')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('shipment.carrier')}</Label>
              <Select value={watchedCarrier} onValueChange={handleCarrierChange}>
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

            {watchedCarrier === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor={`${id}-shipment-carrier-custom`}>
                  {t('shipment.carrierCustom')}
                </Label>
                <Input id={`${id}-shipment-carrier-custom`} {...form.register('carrierCustom')} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`${id}-shipment-tracking`}>{t('shipment.trackingNumber')}</Label>
              <Input
                id={`${id}-shipment-tracking`}
                className="font-mono"
                {...form.register('trackingNumber')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-shipment-expected-delivery`}>
                {t('shipment.expectedDelivery')}
              </Label>
              <Input
                id={`${id}-shipment-expected-delivery`}
                type="date"
                {...form.register('expectedDeliveryAt', {
                  setValueAs: (v: string) => (v ? new Date(v) : undefined),
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-shipment-notes`}>{t('shipment.notes')}</Label>
              <Textarea id={`${id}-shipment-notes`} rows={2} {...form.register('notes')} />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {!!isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('shipment.createTitle')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
