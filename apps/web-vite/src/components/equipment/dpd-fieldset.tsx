import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

export interface DpdAddress {
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export type ParcelSize = 'small' | 'medium' | 'large';

export interface DpdFieldsetProps {
  address: DpdAddress;
  onAddressChange: (address: DpdAddress) => void;
  parcelSize: ParcelSize;
  onParcelSizeChange: (size: ParcelSize) => void;
}

export function DpdFieldset({
  address,
  onAddressChange,
  parcelSize,
  onParcelSizeChange,
}: DpdFieldsetProps) {
  const t = useTranslations('Equipment.dpd');
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
              htmlFor={`dpd-parcel-${size}`}
              className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem id={`dpd-parcel-${size}`} value={size} />
              <span className="text-sm">{tCarrier(size)}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
