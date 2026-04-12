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
import { trpc } from "@/trpc/init";

interface VatRateSelectorProps {
  value?: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function VatRateSelector({ value, onChange, disabled }: VatRateSelectorProps) {
  const ratesQuery = trpc.tax.getRates.useQuery();

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

  // Group rates by category
  const defaultRates = ratesQuery.data.filter(
    (r) => !r.isExempt && !r.isReverseCharge && r.ratePercent > 0 && r.isDefault,
  );
  const reducedRates = ratesQuery.data.filter(
    (r) => !r.isExempt && !r.isReverseCharge && r.ratePercent > 0 && !r.isDefault,
  );
  const exemptRates = ratesQuery.data.filter((r) => r.isExempt || r.ratePercent === 0);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select VAT rate" />
      </SelectTrigger>
      <SelectContent>
        {defaultRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">
              Standard Rates
            </SelectLabel>
            {defaultRates.map((rate) => (
              <SelectItem key={rate.id} value={rate.code}>
                {rate.ratePercent}% &mdash; {rate.description}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {reducedRates.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-medium text-muted-foreground">
              Reduced Rates
            </SelectLabel>
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
                {rate.code === "ZW"
                  ? "ZW \u2014 Tax exempt"
                  : rate.code === "NP"
                    ? "NP \u2014 Not applicable"
                    : `${rate.ratePercent}% \u2014 ${rate.description}`}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
