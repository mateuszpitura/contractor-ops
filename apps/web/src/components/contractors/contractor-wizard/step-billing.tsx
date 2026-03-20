"use client";

import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { WizardFormValues } from "./wizard-dialog";

interface StepBillingProps {
  form: UseFormReturn<WizardFormValues>;
}

const BILLING_MODELS = [
  { value: "FIXED", labelKey: "FIXED" },
  { value: "HOURLY", labelKey: "HOURLY" },
  { value: "PROJECT", labelKey: "PROJECT" },
  { value: "MILESTONE", labelKey: "MILESTONE" },
] as const;

const CURRENCIES = ["PLN", "EUR", "USD"] as const;

/**
 * Step 2: Billing configuration.
 * Fields: billing model, currency, rate, bank account IBAN, payment terms.
 */
export function StepBilling({ form }: StepBillingProps) {
  const t = useTranslations("ContractorWizard.fields");
  const tb = useTranslations("ContractorWizard.billingModelOptions");

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  // Rate display: store as grosze, display as zloty
  const rateGrosze = watch("rateValueGrosze");
  const rateDisplay =
    typeof rateGrosze === "number" && rateGrosze > 0
      ? (rateGrosze / 100).toFixed(2)
      : "";

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setValue("rateValueGrosze", Math.round(value * 100), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else if (e.target.value === "") {
      setValue("rateValueGrosze", 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Billing model */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t("billingModel")}</Label>
        <Select
          value={watch("billingModel") ?? ""}
          onValueChange={(value) =>
            setValue("billingModel", value ?? "", {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("billingModel")} />
          </SelectTrigger>
          <SelectContent>
            {BILLING_MODELS.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {tb(model.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.billingModel && (
          <p className="text-sm text-destructive">
            {errors.billingModel.message}
          </p>
        )}
      </div>

      {/* Currency */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t("currency")}</Label>
        <Select
          value={watch("currency") ?? "PLN"}
          onValueChange={(value) =>
            setValue("currency", value ?? "PLN", {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.currency && (
          <p className="text-sm text-destructive">
            {errors.currency.message}
          </p>
        )}
      </div>

      {/* Default rate (display as zloty, store as grosze) */}
      <div className="space-y-2">
        <Label htmlFor="rate" className="text-[13px]">
          {t("rate")}
        </Label>
        <div className="relative">
          <Input
            id="rate"
            type="number"
            step="0.01"
            min="0"
            className="font-mono pr-16"
            value={rateDisplay}
            onChange={handleRateChange}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {watch("currency") ?? "PLN"}
          </span>
        </div>
        {errors.rateValueGrosze && (
          <p className="text-sm text-destructive">
            {errors.rateValueGrosze.message}
          </p>
        )}
      </div>

      {/* Bank account IBAN */}
      <div className="space-y-2">
        <Label htmlFor="bankAccount" className="text-[13px]">
          {t("bankAccount")}
        </Label>
        <Input
          id="bankAccount"
          className="font-mono"
          placeholder="PL00 0000 0000 0000 0000 0000 0000"
          {...register("bankAccount")}
        />
        {errors.bankAccount && (
          <p className="text-sm text-destructive">
            {errors.bankAccount.message}
          </p>
        )}
      </div>

      {/* Payment terms */}
      <div className="space-y-2">
        <Label htmlFor="paymentTermsDays" className="text-[13px]">
          {t("paymentTerms")}
        </Label>
        <Input
          id="paymentTermsDays"
          type="number"
          min="1"
          placeholder="30"
          {...register("paymentTermsDays", { valueAsNumber: true })}
        />
      </div>
    </div>
  );
}
