import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Loader2, Package, Truck } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { isCarrierFormValid } from '../../lib/carrier-validation.js';
import type { DpdAddress, ParcelSize } from './dpd-fieldset.js';
import { DpdFieldset } from './dpd-fieldset.js';
import type { useCarrierShipmentForm } from './hooks/use-carrier-shipment-form.js';
import { PaczkomatDisplay } from './paczkomat-display.js';
import type { PaczkomatPoint } from './paczkomat-picker.js';
import { PaczkomatPicker } from './paczkomat-picker.js';
import type { UpsServiceCode } from './ups-fieldset.js';
import { UpsFieldset } from './ups-fieldset.js';

type Carrier = 'inpost' | 'dpd' | 'ups';

const DEFAULT_ADDRESS: DpdAddress = {
  street: '',
  city: '',
  postalCode: '',
  countryCode: 'PL',
};

export interface CarrierShipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentIds: string[];
  contractorName: string;
  preferredPaczkomat?: PaczkomatPoint | null;
  direction: 'OUTBOUND' | 'RETURN';
  configuredCarriers: string[];
  onSuccess: () => void;
}

type CarrierShipmentFormViewProps = CarrierShipmentFormProps &
  Pick<ReturnType<typeof useCarrierShipmentForm>, 'isPending' | 'submitShipment'>;

export function CarrierShipmentFormView({
  open,
  onOpenChange,
  equipmentIds,
  contractorName,
  preferredPaczkomat,
  direction,
  configuredCarriers,
  onSuccess: _onSuccess,
  isPending,
  submitShipment,
}: CarrierShipmentFormViewProps) {
  const t = useTranslations('Equipment.carrier');
  const tInpost = useTranslations('Equipment.inpost');

  const CARRIER_LABELS: Record<Carrier, string> = {
    inpost: 'InPost',
    dpd: 'DPD',
    ups: 'UPS',
  };

  const defaultCarrier =
    configuredCarriers.length === 1 ? (configuredCarriers[0] as Carrier) : undefined;

  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | undefined>(defaultCarrier);
  const [selectedPoint, setSelectedPoint] = useState<PaczkomatPoint | null>(
    preferredPaczkomat ?? null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [parcelSize, setParcelSize] = useState<ParcelSize>('medium');
  const [address, setAddress] = useState<DpdAddress>({ ...DEFAULT_ADDRESS });
  const [serviceCode, setServiceCode] = useState<UpsServiceCode>('11');

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

  const handleCarrierChange = useCallback(
    (val: string | null) => {
      if (!val) return;
      const carrier = val as Carrier;
      setSelectedCarrier(carrier);
      setAddress({ ...DEFAULT_ADDRESS });
      setParcelSize('medium');
      setServiceCode('11');
      setSelectedPoint(preferredPaczkomat ?? null);
    },
    [preferredPaczkomat],
  );

  const isFormValid = isCarrierFormValid(selectedCarrier ?? '', {
    selectedPoint,
    address,
    serviceCode,
  });

  const handleSubmit = useCallback(() => {
    if (!(selectedCarrier && isFormValid)) return;
    submitShipment({
      carrier: selectedCarrier,
      equipmentIds,
      direction,
      selectedPoint,
      address,
      parcelSize,
      serviceCode,
    });
  }, [
    selectedCarrier,
    isFormValid,
    selectedPoint,
    equipmentIds,
    parcelSize,
    direction,
    address,
    serviceCode,
    submitShipment,
  ]);

  // Geowidget token comes from VITE-prefixed env at build time. Optional —
  // falls back to empty string so the iframe surfaces its own no-token error
  // state when unset in the build.
  const geowidgetToken = ((import.meta.env as Record<string, string | undefined>)
    .VITE_INPOST_GEOWIDGET_TOKEN ?? '') as string;

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

            {selectedCarrier === 'inpost' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{tInpost('recipient')}</Label>
                  <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    {contractorName}
                  </div>
                </div>

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

            {selectedCarrier === 'dpd' && (
              <DpdFieldset
                address={address}
                onAddressChange={setAddress}
                parcelSize={parcelSize}
                onParcelSizeChange={setParcelSize}
              />
            )}

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
            {/* biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
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
