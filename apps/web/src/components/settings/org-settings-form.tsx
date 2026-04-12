"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const updateSettingsSchema = z.object({
  name: z.string().min(2).max(255),
  legalName: z.string().max(255).optional(),
  country: z.string().length(2),
  currency: z.string().length(3),
  timezone: z.string().min(1),
  language: z.enum(["pl", "en"]),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  billingEmail: z.string().email().optional().or(z.literal("")),
});

type SettingsValues = z.infer<typeof updateSettingsSchema>;

// ---------------------------------------------------------------------------
// Reference data — built from Intl APIs for completeness
// ---------------------------------------------------------------------------

/** All IANA timezones from the browser's Intl API */
function getAllTimezones(): Array<{ value: string; label: string }> {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.map((tz) => {
      // Format: "Europe/Warsaw" → "Europe/Warsaw (GMT+1)"
      try {
        const offset =
          new Intl.DateTimeFormat("en", {
            timeZone: tz,
            timeZoneName: "shortOffset",
          })
            .formatToParts(new Date())
            .find((p) => p.type === "timeZoneName")?.value ?? "";
        return { value: tz, label: `${tz.replace(/_/g, " ")} (${offset})` };
      } catch {
        return { value: tz, label: tz.replace(/_/g, " ") };
      }
    });
  } catch {
    // Fallback for older browsers
    return [
      { value: "Europe/Warsaw", label: "Europe/Warsaw (GMT+1)" },
      { value: "Europe/Berlin", label: "Europe/Berlin (GMT+1)" },
      { value: "Europe/London", label: "Europe/London (GMT+0)" },
      { value: "America/New_York", label: "America/New York (GMT-5)" },
      { value: "UTC", label: "UTC" },
    ];
  }
}

/** All currencies via Intl.DisplayNames */
function getAllCurrencies(): Array<{ value: string; label: string }> {
  // Common currencies first, then alphabetical
  const common = [
    "PLN",
    "EUR",
    "USD",
    "GBP",
    "CHF",
    "CZK",
    "SEK",
    "NOK",
    "DKK",
    "HUF",
    "RON",
    "BGN",
    "HRK",
    "UAH",
    "JPY",
    "CNY",
    "AUD",
    "CAD",
    "BRL",
    "INR",
  ];
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "currency" });
    return common.map((code) => ({
      value: code,
      label: `${code} — ${displayNames.of(code) ?? code}`,
    }));
  } catch {
    return common.map((code) => ({ value: code, label: code }));
  }
}

/** All countries via Intl.DisplayNames */
function getAllCountries(): Array<{ value: string; label: string }> {
  const codes = [
    "PL",
    "DE",
    "GB",
    "US",
    "FR",
    "IT",
    "ES",
    "NL",
    "BE",
    "AT",
    "CH",
    "CZ",
    "SK",
    "HU",
    "RO",
    "BG",
    "HR",
    "SI",
    "LT",
    "LV",
    "EE",
    "SE",
    "NO",
    "DK",
    "FI",
    "IE",
    "PT",
    "GR",
    "UA",
    "CA",
    "AU",
    "JP",
    "CN",
    "IN",
    "BR",
    "MX",
    "KR",
    "SG",
    "HK",
    "NZ",
    "IL",
    "AE",
    "SA",
    "ZA",
    "TR",
    "AR",
    "CL",
    "CO",
    "PE",
  ];
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return codes
      .map((code) => ({
        value: code,
        label: displayNames.of(code) ?? code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return codes
      .map((code) => ({ value: code, label: code }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}

/** Locale-aware month names via Intl.DateTimeFormat */
function getMonths(locale: string): Array<{ value: number; label: string }> {
  const formatter = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: formatter.format(new Date(2024, i, 1)),
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Organization settings form.
 * Fetches current settings via tRPC, allows editing, saves via tRPC mutation.
 */
export function OrgSettingsForm() {
  const t = useTranslations("Settings");
  const tToast = useTranslations("Settings.toast");
  const locale = useLocale();
  const queryClient = useQueryClient();

  // Memoize reference data so it's only computed once
  const timezones = useMemo(() => getAllTimezones(), []);
  const currencies = useMemo(() => getAllCurrencies(), []);
  const countries = useMemo(() => getAllCountries(), []);
  const months = useMemo(() => getMonths(locale), [locale]);

  const settingsQuery = useQuery(trpc.settings.get.queryOptions());

  const updateMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("savedToast"));
        queryClient.invalidateQueries({ queryKey: trpc.settings.get.queryKey() });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || tToast("saveSettingsFailed"));
      },
    }),
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      name: "",
      legalName: "",
      country: "PL",
      currency: "PLN",
      timezone: "Europe/Warsaw",
      language: "pl",
      fiscalYearStartMonth: 1,
      billingEmail: "",
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (settingsQuery.data) {
      const data = settingsQuery.data;
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      reset({
        name: data.name ?? "",
        legalName: (metadata.legalName as string) ?? "",
        country: (metadata.countryCode as string) ?? "PL",
        currency: (metadata.defaultCurrency as string) ?? "PLN",
        timezone: (metadata.timezone as string) ?? "Europe/Warsaw",
        language: ((metadata.language as string) ?? "pl") as "pl" | "en",
        fiscalYearStartMonth: (metadata.fiscalYearStartMonth as number) ?? 1,
        billingEmail: (metadata.billingEmail as string) ?? "",
      });
    }
  }, [settingsQuery.data, reset]);

  const onSubmit = (values: SettingsValues) => {
    updateMutation.mutate({
      name: values.name,
      legalName: values.legalName || undefined,
      fiscalYearStartMonth: values.fiscalYearStartMonth,
      billingEmail: values.billingEmail || undefined,
      language: values.language,
    });
  };

  if (settingsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full max-w-lg" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t("tabs.general")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 max-w-lg">
          {/* Organization name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[13px]">
              {t("fields.orgName")}
            </Label>
            <Input id="name" disabled={updateMutation.isPending} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          {/* Legal name */}
          <div className="space-y-1.5">
            <Label htmlFor="legalName" className="text-[13px]">
              {t("fields.legalName")}{" "}
              <span className="text-muted-foreground">{t("fields.legalNameOptional")}</span>
            </Label>
            <Input id="legalName" disabled={updateMutation.isPending} {...register("legalName")} />
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label htmlFor="country" className="text-[13px]">
              {t("fields.country")}
            </Label>
            <Select
              value={watch("country")}
              onValueChange={(value) => {
                if (value) setValue("country", value, { shouldDirty: true });
              }}
              disabled={updateMutation.isPending}
              items={countries}
            >
              <SelectTrigger id="country" className="w-full">
                <SelectValue placeholder={t("fields.countryPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {countries.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label htmlFor="currency" className="text-[13px]">
              {t("fields.currency")}
            </Label>
            <Select
              value={watch("currency")}
              onValueChange={(value) => {
                if (value) setValue("currency", value, { shouldDirty: true });
              }}
              disabled={updateMutation.isPending}
              items={currencies}
            >
              <SelectTrigger id="currency" className="w-full">
                <SelectValue placeholder={t("fields.currencyPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {currencies.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-[13px]">
              {t("fields.timezone")}
            </Label>
            <Select
              value={watch("timezone")}
              onValueChange={(value) => {
                if (value) setValue("timezone", value, { shouldDirty: true });
              }}
              disabled={updateMutation.isPending}
              items={timezones}
            >
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue placeholder={t("fields.timezonePlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label htmlFor="language" className="text-[13px]">
              {t("fields.language")}
            </Label>
            <Select
              value={watch("language")}
              onValueChange={(value) => {
                if (value) setValue("language", value as "pl" | "en", { shouldDirty: true });
              }}
              disabled={updateMutation.isPending}
              items={[
                { value: "pl", label: t("fields.languagePolish") },
                { value: "en", label: t("fields.languageEnglish") },
              ]}
            >
              <SelectTrigger id="language" className="w-full">
                <SelectValue placeholder={t("fields.languagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pl">{t("fields.languagePolish")}</SelectItem>
                <SelectItem value="en">{t("fields.languageEnglish")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fiscal year start */}
          <div className="space-y-1.5">
            <Label htmlFor="fiscalYearStartMonth" className="text-[13px]">
              {t("fields.fiscalYear")}
            </Label>
            <Select
              value={String(watch("fiscalYearStartMonth"))}
              onValueChange={(value) => {
                if (!value) return;
                setValue("fiscalYearStartMonth", Number.parseInt(value, 10), { shouldDirty: true });
              }}
              disabled={updateMutation.isPending}
              items={months.map((m) => ({ value: String(m.value), label: m.label }))}
            >
              <SelectTrigger id="fiscalYearStartMonth" className="w-full">
                <SelectValue placeholder={t("fields.fiscalYearPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Billing email */}
          <div className="space-y-1.5">
            <Label htmlFor="billingEmail" className="text-[13px]">
              {t("fields.billingEmail")}{" "}
              <span className="text-muted-foreground">{t("fields.billingEmailOptional")}</span>
            </Label>
            <Input
              id="billingEmail"
              type="email"
              disabled={updateMutation.isPending}
              {...register("billingEmail")}
            />
            {errors.billingEmail && (
              <p className="text-sm text-destructive">{errors.billingEmail.message}</p>
            )}
          </div>
        </CardContent>

        {/* Consistent footer with save button */}
        <CardFooter>
          <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
            {updateMutation.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="me-2 h-4 w-4" />
            )}
            {updateMutation.isPending ? t("saving") : t("saveCta")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
