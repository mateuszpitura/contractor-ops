import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';

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

  const updateField = (field: keyof DpdAddress, value: string) => {
    onAddressChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t('deliveryAddress')}</Label>

        <div className="space-y-2">
          <Input
            placeholder={t('street')}
            value={address.street}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => updateField('street', e.target.value)}
            aria-label={t('street')}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t('city')}
              value={address.city}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => updateField('city', e.target.value)}
              aria-label={t('city')}
            />
            <Input
              placeholder={t('postalCode')}
              value={address.postalCode}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
              onChange={e => updateField('postalCode', e.target.value)}
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
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={val => val && onParcelSizeChange(val as ParcelSize)}
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
