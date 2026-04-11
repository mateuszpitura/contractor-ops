"use client";

import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

interface VatRateSelectorProps {
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function VatRateSelector({ value, onChange, disabled }: VatRateSelectorProps) {
  const ratesQuery = api.tax.getRates.useQuery();

  if (ratesQuery.isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading rates...</span>
      </div>
    );
  }

  if (!ratesQuery.data || ratesQuery.data.length === 0) {
    return (
      <div className="flex h-10 items-center rounded-md border border-input bg-muted px-4">
        <span className="text-sm text-muted-foreground">No tax rates configured</span>
      </div>
    );
  }

  const standardRates = ratesQuery.data.filter((r) => r.isDefault && !r.isExempt);
  const reducedRates = ratesQuery.data.filter((r) => !r.isDefault && !r.isExempt && !r.isReverseCharge && r.ratePercent > 0);
  const exemptRates = ratesQuery.data.filter((r) => r.isExempt || r.ratePercent === 0);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select VAT rate" />
      </SelectTrigger>
      <SelectContent>
        {standardRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">Standard Rates</SelectLabel>
            {standardRates.map((rate) => (
              <SelectItem key={rate.id} value={rate.code}>
                {rate.ratePercent}% &mdash; {rate.description}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {reducedRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">Reduced Rates</SelectLabel>
            {reducedRates.map((rate) => (
              <SelectItem key={rate.id} value={rate.code}>
                {rate.ratePercent}% &mdash; {rate.description}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {exemptRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">Exempt</SelectLabel>
            {exemptRates.map((rate) => (
              <SelectItem key={rate.id} value={rate.code}>
                {rate.code === "ZW" ? "ZW - Tax exempt" : rate.code === "NP" ? "NP - Not applicable" : `${rate.ratePercent}% - ${rate.description}`}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
