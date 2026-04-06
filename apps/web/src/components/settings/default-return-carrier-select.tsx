"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Carrier labels
// ---------------------------------------------------------------------------

const CARRIER_LABELS: Record<string, string> = {
  inpost: "InPost",
  dpd: "DPD",
  ups: "UPS",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dropdown for selecting the organization's default return carrier.
 * Shows only carriers that have CourierConfig entries.
 * Saves selection to org settingsJson (key: defaultReturnCarrier).
 */
export function DefaultReturnCarrierSelect() {
  const t = useTranslations("Settings.returnCarrier");
  const queryClient = useQueryClient();

  // Fetch configured carriers
  const configsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const configs = (configsQuery.data ?? []) as unknown as Array<{ carrier: string }>;
  const configuredCarriers = configs.map((c) => c.carrier.toLowerCase());

  // Fetch current org settings to get the default return carrier
  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const metadata = ((settingsQuery.data?.metadata ?? {}) as Record<string, unknown>);
  const currentDefault = (metadata.defaultReturnCarrier as string) ?? "";

  // Save mutation
  const saveMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("saved"));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.get.queryKey(),
        });
      },
    }),
  );

  const handleChange = useCallback(
    (val: string | null) => {
      if (!val) return;
      saveMutation.mutate({
        defaultReturnCarrier: val,
      });
    },
    [saveMutation],
  );

  if (configuredCarriers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{t("label")}</Label>
      <Select
        value={currentDefault}
        onValueChange={handleChange}
        disabled={saveMutation.isPending}
      >
        <SelectTrigger className="w-full max-w-xs">
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SelectValue placeholder={t("label")} />
          )}
        </SelectTrigger>
        <SelectContent>
          {configuredCarriers.map((carrier) => (
            <SelectItem key={carrier} value={carrier}>
              {CARRIER_LABELS[carrier] ?? carrier}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t("helper")}</p>
    </div>
  );
}
