'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { DpdAddress, ParcelSize } from './dpd-fieldset';
import { tKey } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UpsServiceCode = '11' | '65' | '07';

export interface UpsFieldsetProps {
  address: DpdAddress;
  onAddressChange: (address: DpdAddress) => void;
  parcelSize: ParcelSize;
  onParcelSizeChange: (size: ParcelSize) => void;
  serviceCode: UpsServiceCode;
  onServiceCodeChange: (code: UpsServiceCode) => void;
}

// ---------------------------------------------------------------------------
// Service type options
// ---------------------------------------------------------------------------

const SERVICE_OPTIONS: { value: UpsServiceCode; labelKey: string }[] = [
  { value: '11', labelKey: 'standard' },
  { value: '65', labelKey: 'expressSaver' },
  { value: '07', labelKey: 'express' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UPS-specific form fields: delivery address, parcel size, and service type.
 * Used inside CarrierShipmentForm when UPS carrier is selected.
 */
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

  const updateField = (field: keyof DpdAddress, value: string) => {
    onAddressChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Delivery address section */}
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

          {/* Country code - defaults to PL, read-only */}
          <input type="hidden" value={address.countryCode} />
        </div>
      </div>

      {/* Parcel size */}
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
              htmlFor={`ups-parcel-${size}`}
              className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem id={`ups-parcel-${size}`} value={size} />
              <span className="text-sm">{tCarrier(size)}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Service type (UPS-specific) */}
      <div className="space-y-2">
        <Label>{t('serviceType')}</Label>
        <Select
          value={serviceCode}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={val => val && onServiceCodeChange(val as UpsServiceCode)}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
