'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Package, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isCarrierFormValid } from '@/lib/carrier-validation';
import { trpc } from '@/trpc/init';
import type { DpdAddress, ParcelSize } from './dpd-fieldset';
import { DpdFieldset } from './dpd-fieldset';
import { PaczkomatDisplay } from './paczkomat-display';
import type { PaczkomatPoint } from './paczkomat-picker';
import { PaczkomatPicker } from './paczkomat-picker';
import type { UpsServiceCode } from './ups-fieldset';
import { UpsFieldset } from './ups-fieldset';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Carrier = 'inpost' | 'dpd' | 'ups';

interface CarrierShipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentIds: string[];
  contractorName: string;
  preferredPaczkomat?: PaczkomatPoint | null;
  direction: 'OUTBOUND' | 'RETURN';
  configuredCarriers: string[];
  onSuccess: () => void;
}

const CARRIER_LABELS: Record<Carrier, string> = {
  inpost: 'InPost',
  dpd: 'DPD',
  ups: 'UPS',
};

const DEFAULT_ADDRESS: DpdAddress = {
  street: '',
  city: '',
  postalCode: '',
  countryCode: 'PL',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Unified carrier shipment form with dynamic fieldsets per selected carrier.
 * Shows only configured carriers in the dropdown (D-10).
 * Dispatches to the correct tRPC mutation based on carrier selection.
 */
export function CarrierShipmentForm({
  open,
  onOpenChange,
  equipmentIds,
  contractorName,
  preferredPaczkomat,
  direction,
  configuredCarriers,
  onSuccess,
}: CarrierShipmentFormProps) {
  const t = useTranslations('Equipment.carrier');
  const tInpost = useTranslations('Equipment.inpost');
  const queryClient = useQueryClient();

  // Auto-select if only one carrier configured
  const defaultCarrier =
    configuredCarriers.length === 1 ? (configuredCarriers[0] as Carrier) : undefined;

  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | undefined>(defaultCarrier);

  // InPost state
  const [selectedPoint, setSelectedPoint] = useState<PaczkomatPoint | null>(
    preferredPaczkomat ?? null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Shared state
  const [parcelSize, setParcelSize] = useState<ParcelSize>('medium');

  // DPD/UPS state
  const [address, setAddress] = useState<DpdAddress>({ ...DEFAULT_ADDRESS });

  // UPS-specific state
  const [serviceCode, setServiceCode] = useState<UpsServiceCode>('11');

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) {
        setSelectedCarrier(defaultCarrier);
        setSelectedPoint(preferredPaczkomat ?? null);
        setParcelSize('medium');
        setAddress({ ...DEFAULT_ADDRESS });
        setServiceCode('11');
      }
      onOpenChange(v);
    },
    [onOpenChange, preferredPaczkomat, defaultCarrier],
  );

  // Handle carrier change -- clear carrier-specific state
  const handleCarrierChange = useCallback(
    (val: string | null) => {
      if (!val) return;
      const carrier = val as Carrier;
      setSelectedCarrier(carrier);
      // Reset fieldset state on carrier change
      setAddress({ ...DEFAULT_ADDRESS });
      setParcelSize('medium');
      setServiceCode('11');
      setSelectedPoint(preferredPaczkomat ?? null);
    },
    [preferredPaczkomat],
  );

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.equipment.getById.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.equipment.list.queryKey(),
    });
  }, [queryClient]);

  const onMutationSuccess = useCallback(
    (carrierLabel: string) => {
      toast.success(t('created', { carrier: carrierLabel }));
      invalidateQueries();
      onSuccess();
      onOpenChange(false);
    },
    [t, invalidateQueries, onSuccess, onOpenChange],
  );

  const onMutationError = useCallback(() => {
    toast.error(t('createError'));
  }, [t]);

  const inpostMutation = useMutation(
    trpc.equipment.createInPostShipment.mutationOptions({
      onSuccess: () => onMutationSuccess('InPost'),
      onError: onMutationError,
    }),
  );

  const dpdMutation = useMutation(
    trpc.equipment.createDpdShipment.mutationOptions({
      onSuccess: () => onMutationSuccess('DPD'),
      onError: onMutationError,
    }),
  );

  const upsMutation = useMutation(
    trpc.equipment.createUpsShipment.mutationOptions({
      onSuccess: () => onMutationSuccess('UPS'),
      onError: onMutationError,
    }),
  );

  const isPending = inpostMutation.isPending || dpdMutation.isPending || upsMutation.isPending;

  // Validate required fields per carrier
  const isFormValid = isCarrierFormValid(selectedCarrier ?? '', {
    selectedPoint,
    address,
    serviceCode,
  });

  const handleSubmit = useCallback(() => {
    if (!(selectedCarrier && isFormValid)) return;

    switch (selectedCarrier) {
      case 'inpost':
        if (!selectedPoint) return;
        inpostMutation.mutate({
          equipmentIds,
          targetPointId: selectedPoint.id,
          targetPointName: selectedPoint.name,
          targetPointAddress: selectedPoint.address,
          parcelSize,
          direction,
        });
        break;
      case 'dpd':
        dpdMutation.mutate({
          equipmentIds,
          deliveryAddress: address,
          parcelSize,
          direction,
        });
        break;
      case 'ups':
        upsMutation.mutate({
          equipmentIds,
          deliveryAddress: address,
          parcelSize,
          serviceCode,
          direction,
        });
        break;
    }
  }, [
    selectedCarrier,
    isFormValid,
    selectedPoint,
    equipmentIds,
    parcelSize,
    direction,
    address,
    serviceCode,
    inpostMutation,
    dpdMutation,
    upsMutation,
  ]);

  const geowidgetToken =
    typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN ?? '');

  // Empty state: no carriers configured
  if (configuredCarriers.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('createShipment')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Truck className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('noCarriers')}</p>
              <p className="text-sm text-muted-foreground">{t('noCarriersBody')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('createShipment')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Carrier dropdown */}
            <div className="space-y-2">
              <Label>{t('selectCarrier')}</Label>
              <Select value={selectedCarrier ?? ''} onValueChange={handleCarrierChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectCarrier')} />
                </SelectTrigger>
                <SelectContent>
                  {configuredCarriers.map(carrier => (
                    <SelectItem key={carrier} value={carrier}>
                      {CARRIER_LABELS[carrier as Carrier] ?? carrier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* InPost fieldset */}
            {selectedCarrier === 'inpost' && (
              <div className="space-y-4">
                {/* Recipient (read-only) */}
                <div className="space-y-2">
                  <Label>{tInpost('recipient')}</Label>
                  <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    {contractorName}
                  </div>
                </div>

                {/* Paczkomat destination */}
                <div className="space-y-2">
                  <Label>{tInpost('destinationPaczkomat')}</Label>
                  {selectedPoint ? (
                    <PaczkomatDisplay
                      pointId={selectedPoint.id}
                      pointName={selectedPoint.name}
                      pointAddress={selectedPoint.address}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                      onChangeClick={() => setPickerOpen(true)}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => setPickerOpen(true)}>
                      <Package className="me-2 h-4 w-4" />
                      {tInpost('selectPaczkomat')}
                    </Button>
                  )}
                </div>

                {/* Parcel size */}
                <div className="space-y-2">
                  <Label>{t('parcelSize')}</Label>
                  <RadioGroup
                    value={parcelSize}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                    onValueChange={val => val && setParcelSize(val as ParcelSize)}
                    className="flex gap-4">
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <label
                        key={size}
                        htmlFor={`parcel-size-${size}`}
                        className="flex cursor-pointer items-center gap-2">
                        <RadioGroupItem id={`parcel-size-${size}`} value={size} />
                        <span className="text-sm">{t(size)}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* DPD fieldset */}
            {selectedCarrier === 'dpd' && (
              <DpdFieldset
                address={address}
                onAddressChange={setAddress}
                parcelSize={parcelSize}
                onParcelSizeChange={setParcelSize}
              />
            )}

            {/* UPS fieldset */}
            {selectedCarrier === 'ups' && (
              <UpsFieldset
                address={address}
                onAddressChange={setAddress}
                parcelSize={parcelSize}
                onParcelSizeChange={setParcelSize}
                serviceCode={serviceCode}
                onServiceCodeChange={setServiceCode}
              />
            )}
          </div>

          <DialogFooter>
            // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || isPending}>
              {!!isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('createShipment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Paczkomat picker for InPost */}
      {selectedCarrier === 'inpost' && (
        <PaczkomatPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={setSelectedPoint}
          geowidgetToken={geowidgetToken}
        />
      )}
    </>
  );
}
