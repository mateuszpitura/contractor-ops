"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const transferTitleSchema = z.object({
  template: z.string().min(1).max(200),
});

type TransferTitleFormValues = z.infer<typeof transferTitleSchema>;

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

const EXAMPLE_VALUES: Record<string, string> = {
  invoice_number: "FV/2026/03/001",
  billing_period: "2026-03",
  contractor_name: "Acme Sp. z o.o.",
  contract_number: "C-001",
};

function resolvePreview(template: string): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    return EXAMPLE_VALUES[key] ?? `{${key}}`;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransferTitleSettings() {
  const t = useTranslations("Payments");
  const queryClient = useQueryClient();

  // Load current settings
  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgData = settingsQuery.data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsJson = (orgData?.metadata as any)?.settingsJson ?? {};
  const currentTemplate: string =
    settingsJson.paymentTransferTitleTemplate ?? "{invoice_number}";

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty, errors },
  } = useForm<TransferTitleFormValues>({
    resolver: zodResolver(transferTitleSchema),
    defaultValues: {
      template: "{invoice_number}",
    },
  });

  // Sync loaded value into form
  useEffect(() => {
    if (currentTemplate) {
      reset({ template: currentTemplate });
    }
  }, [currentTemplate, reset]);

  const watchTemplate = watch("template");
  const preview = useMemo(() => resolvePreview(watchTemplate), [watchTemplate]);

  const updateMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("toastTransferTitleSaved"));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.get.queryKey(),
        });
      },
      onError: () => {
        toast.error(t("errorExport"));
      },
    }),
  );

  function onSubmit(values: TransferTitleFormValues) {
    // Merge paymentTransferTitleTemplate into existing settingsJson
    const existingSettingsJson = settingsJson ?? {};
    const newSettingsJson = {
      ...existingSettingsJson,
      paymentTransferTitleTemplate: values.template,
    };

    updateMutation.mutate({
      settingsJson: newSettingsJson,
    } as Parameters<typeof updateMutation.mutate>[0]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settingsHeading")}</CardTitle>
        <CardDescription>{t("settingsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="transfer-title-template" className="text-sm font-medium">
              {t("templateLabel")}
            </label>
            <Input
              id="transfer-title-template"
              placeholder={t("templatePlaceholder")}
              {...register("template")}
            />
            <p className="text-xs text-muted-foreground">
              {t("templateHelper")}
            </p>
            {errors.template && (
              <p className="text-xs text-destructive">
                {errors.template.message}
              </p>
            )}
          </div>

          {/* Live preview */}
          <p className="text-xs text-muted-foreground">
            {t("preview", { value: preview })}
          </p>

          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            {t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
