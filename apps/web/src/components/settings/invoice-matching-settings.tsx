"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save, ClipboardCopy } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceMatchingSettings() {
  const t = useTranslations("Settings");
  const tToast = useTranslations("Settings.toast");
  const queryClient = useQueryClient();

  // Load org data for slug (email address)
  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgData = settingsQuery.data as any;
  const orgSlug = orgData?.slug ?? "org";
  const emailAddress = `invoices@${orgSlug}.contractorhub.io`;

  // Load current deviation threshold
  const invoiceSettingsQuery = useQuery(
    trpc.settings.getInvoiceSettings.queryOptions(),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceData = invoiceSettingsQuery.data as any;

  const [threshold, setThreshold] = useState(10);

  useEffect(() => {
    if (invoiceData?.invoiceDeviationThresholdPercent != null) {
      setThreshold(invoiceData.invoiceDeviationThresholdPercent);
    }
  }, [invoiceData]);

  const updateMutation = useMutation(
    trpc.settings.updateInvoiceSettings.mutationOptions({
      onSuccess: () => {
        toast.success(t("invoiceSettingsSaved"));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getInvoiceSettings.queryKey(),
        });
      },
      onError: () => {
        toast.error(tToast("invoiceSettingsFailed"));
      },
    }),
  );

  const handleCopyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(emailAddress);
      toast.success(t("emailCopied"));
    } catch {
      // Fallback: select text for manual copy
    }
  }, [emailAddress, t]);

  function handleSave() {
    if (threshold < 1 || threshold > 100) return;
    updateMutation.mutate({
      invoiceDeviationThresholdPercent: threshold,
    } as Parameters<typeof updateMutation.mutate>[0]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("invoiceEmailInbox")}</CardTitle>
        <CardDescription>{t("invoiceEmailBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email inbox address */}
        <div className="space-y-2">
          <label htmlFor="invoice-email" className="text-sm font-medium">
            {t("invoiceEmailInbox")}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="invoice-email"
              value={emailAddress}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyEmail}
              aria-label={t("copyEmail")}
            >
              <ClipboardCopy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("invoiceEmailBody")}
          </p>
        </div>

        {/* Deviation threshold */}
        <div className="space-y-2">
          <label htmlFor="deviation-threshold" className="text-sm font-medium">
            {t("deviationThreshold")}
          </label>
          <Input
            id="deviation-threshold"
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="max-w-[120px]"
          />
          <p className="text-xs text-muted-foreground">
            {t("deviationThresholdHelp")}
          </p>
        </div>

      </CardContent>
      <CardFooter>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="me-1.5 size-3.5 animate-spin" />
          ) : (
            <Save className="me-1.5 size-3.5" />
          )}
          {t("saveCta")}
        </Button>
      </CardFooter>
    </Card>
  );
}
