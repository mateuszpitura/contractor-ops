import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { useCallback } from 'react';

import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { DpdAddress, ParcelSize } from './dpd-fieldset.js';

export type UpsServiceCode = '11' | '65' | '07';

export interface UpsFieldsetProps {
  address: DpdAddress;
  onAddressChange: (address: DpdAddress) => void;
  parcelSize: ParcelSize;
  onParcelSizeChange: (size: ParcelSize) => void;
  serviceCode: UpsServiceCode;
  onServiceCodeChange: (code: UpsServiceCode) => void;
}

const SERVICE_OPTIONS: { value: UpsServiceCode; labelKey: string }[] = [
  { value: '11', labelKey: 'standard' },
  { value: '65', labelKey: 'expressSaver' },
  { value: '07', labelKey: 'express' },
];

export function UpsFieldset({
  address,
  onAddressChange,
  parcelSize,
  onParcelSizeChange,
  serviceCode,
  onServiceCodeChange,
}: UpsFieldsetProps) {
  const t = useTranslations('Equipment.ups');
  const tCarrier = useTranslations('Equipment.carrier');

  const updateField = useCallback(
    (field: keyof DpdAddress, value: string) => {
      onAddressChange({ ...address, [field]: value });
    },
    [address, onAddressChange],
  );

  const handleStreetChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('street', e.target.value),
    [updateField],
  );
  const handleCityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('city', e.target.value),
    [updateField],
  );
  const handlePostalCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('postalCode', e.target.value),
    [updateField],
  );
  const handleParcelSizeChange = useCallback(
    (val: unknown) => {
      if (val) onParcelSizeChange(val as ParcelSize);
    },
    [onParcelSizeChange],
  );
  const handleServiceCodeChange = useCallback(
    (val: unknown) => {
      if (val) onServiceCodeChange(val as UpsServiceCode);
    },
    [onServiceCodeChange],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t('deliveryAddress')}</Label>

        <div className="space-y-2">
          <Input
            placeholder={t('street')}
            value={address.street}
            onChange={handleStreetChange}
            aria-label={t('street')}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t('city')}
              value={address.city}
              onChange={handleCityChange}
              aria-label={t('city')}
            />
            <Input
              placeholder={t('postalCode')}
              value={address.postalCode}
              onChange={handlePostalCodeChange}
              aria-label={t('postalCode')}
            />
          </div>

          <input type="hidden" value={address.countryCode} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{tCarrier('parcelSize')}</Label>
        <RadioGroup
          value={parcelSize}
          onValueChange={handleParcelSizeChange}
          className="flex gap-4">
          {(['small', 'medium', 'large'] as const).map(size => (
            <label
              key={size}
              htmlFor={`ups-parcel-${size}`}
              className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem id={`ups-parcel-${size}`} value={size} />
              <span className="text-sm">{tCarrier(size)}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>{t('serviceType')}</Label>
        <Select value={serviceCode} onValueChange={handleServiceCodeChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(() => {
                const opt = SERVICE_OPTIONS.find(o => o.value === serviceCode);
                return opt ? tKey(t, opt.labelKey) : serviceCode;
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SERVICE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {tKey(t, opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
