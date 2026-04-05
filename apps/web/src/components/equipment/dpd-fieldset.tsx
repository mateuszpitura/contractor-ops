"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DpdAddress {
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export type ParcelSize = "small" | "medium" | "large";

export interface DpdFieldsetProps {
  address: DpdAddress;
  onAddressChange: (address: DpdAddress) => void;
  parcelSize: ParcelSize;
  onParcelSizeChange: (size: ParcelSize) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DPD-specific form fields: delivery address + parcel size selection.
 * Used inside CarrierShipmentForm when DPD carrier is selected.
 */
export function DpdFieldset({
  address,
  onAddressChange,
  parcelSize,
  onParcelSizeChange,
}: DpdFieldsetProps) {
  const t = useTranslations("Equipment.dpd");
  const tCarrier = useTranslations("Equipment.carrier");

  const updateField = (field: keyof DpdAddress, value: string) => {
    onAddressChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Delivery address section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t("deliveryAddress")}</Label>

        <div className="space-y-2">
          <Input
            placeholder={t("street")}
            value={address.street}
            onChange={(e) => updateField("street", e.target.value)}
            aria-label={t("street")}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t("city")}
              value={address.city}
              onChange={(e) => updateField("city", e.target.value)}
              aria-label={t("city")}
            />
            <Input
              placeholder={t("postalCode")}
              value={address.postalCode}
              onChange={(e) => updateField("postalCode", e.target.value)}
              aria-label={t("postalCode")}
            />
          </div>

          {/* Country code - defaults to PL, read-only */}
          <input type="hidden" value={address.countryCode} />
        </div>
      </div>

      {/* Parcel size */}
      <div className="space-y-2">
        <Label>{tCarrier("parcelSize")}</Label>
        <RadioGroup
          value={parcelSize}
          onValueChange={(val) => val && onParcelSizeChange(val as ParcelSize)}
          className="flex gap-4"
        >
          {(["small", "medium", "large"] as const).map((size) => (
            <label
              key={size}
              className="flex cursor-pointer items-center gap-2"
            >
              <RadioGroupItem value={size} />
              <span className="text-sm">
                {tCarrier(size)}
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
