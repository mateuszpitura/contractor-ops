"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Default fallback values (displayed when not configured)
// ---------------------------------------------------------------------------

const DEFAULT_DAYS = [30, 60, 90];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpiryReminderDefaults() {
  const t = useTranslations("Settings");
  const tToast = useTranslations("Settings.toast");
  const queryClient = useQueryClient();

  const defaultsQuery = useQuery(trpc.settings.getExpiryReminderDefaults.queryOptions());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverDefaults = (defaultsQuery.data as any)?.reminderDaysBefore as number[] | undefined;

  const [inputValue, setInputValue] = useState("");

  // Sync input from server state once loaded
  useEffect(() => {
    if (serverDefaults) {
      setInputValue(serverDefaults.join(", "));
    } else if (!defaultsQuery.isLoading) {
      setInputValue(DEFAULT_DAYS.join(", "));
    }
  }, [serverDefaults, defaultsQuery.isLoading]);

  const updateMutation = useMutation(
    trpc.settings.updateExpiryReminderDefaults.mutationOptions({
      onSuccess: () => {
        toast.success(t("expiryReminders.successToast"));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getExpiryReminderDefaults.queryKey(),
        });
      },
      onError: () => {
        toast.error(tToast("reminderDefaultsFailed"));
      },
    }),
  );

  function handleSave() {
    const days = inputValue
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);

    if (days.length === 0) return;

    updateMutation.mutate({
      reminderDaysBefore: days,
    } as Parameters<typeof updateMutation.mutate>[0]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("expiryReminders.heading")}</CardTitle>
        <CardDescription>{t("expiryReminders.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="reminder-days" className="text-sm font-medium">
            {t("expiryReminders.label")}
          </label>
          <Input
            id="reminder-days"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t("expiryReminders.placeholder")}
          />
          <p className="text-xs text-muted-foreground">{t("expiryReminders.description")}</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="me-1.5 size-3.5 animate-spin" />
          ) : (
            <Save className="me-1.5 size-3.5" />
          )}
          {t("expiryReminders.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
