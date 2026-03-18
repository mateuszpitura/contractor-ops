"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

const updateSettingsSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(255),
  legalName: z.string().max(255).optional(),
  country: z.string().length(2, "Select a country"),
  currency: z.string().length(3, "Select a currency"),
  timezone: z.string().min(1, "Select a timezone"),
  language: z.enum(["pl", "en"]),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  billingEmail: z.string().email("Enter a valid email address").optional().or(z.literal("")),
});

type SettingsValues = z.infer<typeof updateSettingsSchema>;

const countries = [
  { value: "PL", label: "Poland" },
  { value: "DE", label: "Germany" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "CZ", label: "Czech Republic" },
  { value: "SK", label: "Slovakia" },
];

const currencies = [
  { value: "PLN", label: "PLN - Polish Zloty" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CZK", label: "CZK - Czech Koruna" },
];

const timezones = [
  { value: "Europe/Warsaw", label: "Europe/Warsaw" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "UTC", label: "UTC" },
];

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

/**
 * Organization settings form.
 * Fetches current settings via tRPC, allows editing, saves via tRPC mutation.
 */
export function OrgSettingsForm() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery(trpc.settings.get.queryOptions());

  const updateMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: () => {
        toast.success("Settings saved");
        queryClient.invalidateQueries({ queryKey: trpc.settings.get.queryKey() });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : "";
        toast.error(message || "Failed to save settings");
      },
    }),
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
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
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[13px]">
              Organization name
            </Label>
            <Input
              id="name"
              disabled={updateMutation.isPending}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="legalName" className="text-[13px]">
              Legal name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="legalName"
              disabled={updateMutation.isPending}
              {...register("legalName")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country" className="text-[13px]">
              Country
            </Label>
            <Select
              value={watch("country")}
              onValueChange={(value) => {
                if (value) setValue("country", value);
              }}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency" className="text-[13px]">
              Default currency
            </Label>
            <Select
              value={watch("currency")}
              onValueChange={(value) => {
                if (value) setValue("currency", value);
              }}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger id="currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-[13px]">
              Timezone
            </Label>
            <Select
              value={watch("timezone")}
              onValueChange={(value) => {
                if (value) setValue("timezone", value);
              }}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language" className="text-[13px]">
              Language
            </Label>
            <Select
              value={watch("language")}
              onValueChange={(value) => {
                if (value) setValue("language", value as "pl" | "en");
              }}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pl">Polish</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fiscalYearStartMonth" className="text-[13px]">
              Fiscal year start month
            </Label>
            <Select
              value={String(watch("fiscalYearStartMonth"))}
              onValueChange={(value) => {
                if (!value) return;
                setValue("fiscalYearStartMonth", Number.parseInt(value, 10));
              }}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger id="fiscalYearStartMonth">
                <SelectValue placeholder="Select month" />
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

          <div className="space-y-2">
            <Label htmlFor="billingEmail" className="text-[13px]">
              Billing email <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="billingEmail"
              type="email"
              disabled={updateMutation.isPending}
              {...register("billingEmail")}
            />
            {errors.billingEmail && (
              <p className="text-sm text-destructive">
                {errors.billingEmail.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
