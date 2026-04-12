"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/init";
import { CalendarEventConfigDialog } from "./calendar-event-config-dialog";

// Inline type to avoid cross-package build dependency in parallel execution
interface CalendarTaskConfigType {
  calendarEnabled: boolean;
  titleTemplate?: string;
  duration: "30m" | "1h" | "2h" | "4h" | "full_day";
  attendees: string[];
}

// ---------------------------------------------------------------------------
// Duration label map
// ---------------------------------------------------------------------------

const DURATION_LABELS: Record<string, string> = {
  "30m": "30 min",
  "1h": "1 hour",
  "2h": "2 hours",
  "4h": "4 hours",
  full_day: "Full day",
};

// ---------------------------------------------------------------------------
// CalendarTaskConfig
// ---------------------------------------------------------------------------

interface CalendarTaskConfigProps {
  taskTemplateId: string;
}

export function CalendarTaskConfig({ taskTemplateId }: CalendarTaskConfigProps) {
  const t = useTranslations("CalendarSettings");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch current config
  const configQuery = useQuery(trpc.calendar.getTaskConfig.queryOptions({ taskTemplateId }));
  const config = configQuery.data as CalendarTaskConfigType | undefined;

  // Save mutation
  const saveMutation = useMutation(
    trpc.calendar.saveTaskConfig.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.calendar.getTaskConfig.queryKey({ taskTemplateId }),
        });
      },
    }),
  );

  // Toggle handler
  function handleToggle(checked: boolean) {
    if (!config) return;
    saveMutation.mutate({
      taskTemplateId,
      config: { ...config, calendarEnabled: checked },
    });
  }

  // Save from dialog
  function handleSaveConfig(updatedConfig: CalendarTaskConfigType) {
    saveMutation.mutate(
      { taskTemplateId, config: updatedConfig },
      {
        onSuccess: () => {
          toast.success(t("eventConfigSaved"));
        },
      },
    );
  }

  // Loading state
  if (configQuery.isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-9" />
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="ms-auto h-8 w-20" />
      </div>
    );
  }

  const isConfigured = !!config?.titleTemplate;
  const durationLabel = config?.duration
    ? (DURATION_LABELS[config.duration] ?? config.duration)
    : "";
  const summaryText = isConfigured
    ? `${config.titleTemplate} - ${durationLabel}`
    : t("notConfigured");

  return (
    <>
      <div className="flex items-center gap-3">
        <Switch
          checked={config?.calendarEnabled ?? false}
          onCheckedChange={handleToggle}
          disabled={!isConfigured}
          aria-label={t("createCalendarEvent")}
        />
        <span className="text-sm">{t("createCalendarEvent")}</span>
        <span className={`flex-1 text-sm ${isConfigured ? "" : "text-muted-foreground"}`}>
          {summaryText}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
          {t("configureButton")}
        </Button>
      </div>

      <CalendarEventConfigDialog
        taskTemplateId={taskTemplateId}
        config={
          config ?? {
            calendarEnabled: false,
            duration: "1h" as const,
            attendees: [],
          }
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveConfig}
      />
    </>
  );
}
