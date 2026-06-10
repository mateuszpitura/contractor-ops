import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useCallback, useState } from 'react';
import { CalendarEventConfigDialog } from './calendar-event-config-dialog.js';
import type { useCalendarTaskConfig as UseCalendarTaskConfig } from './hooks/use-calendar-task-config.js';
import { useCalendarTaskConfig } from './hooks/use-calendar-task-config.js';

export function CalendarTaskConfigSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-5 w-9" />
      <Skeleton className="h-4 w-[40%]" />
      <Skeleton className="ms-auto h-8 w-20" />
    </div>
  );
}

type CalendarTaskConfigViewProps = Omit<ReturnType<typeof UseCalendarTaskConfig>, 'configQuery'>;

export function CalendarTaskConfigView({
  taskTemplateId,
  t,
  config,
  saveMutation,
  handleToggle,
  handleSaveConfig,
  isConfigured,
  summaryText,
  defaultConfig,
}: CalendarTaskConfigViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const handleOpenDialog = useCallback(() => setDialogOpen(true), []);

  return (
    <>
      <div className="flex items-center gap-3">
        <Switch
          checked={config?.calendarEnabled ?? false}
          onCheckedChange={handleToggle}
          disabled={!isConfigured || saveMutation.isPending}
          aria-label={t('createCalendarEvent')}
        />
        <span className="text-sm">{t('createCalendarEvent')}</span>
        <span className={`flex-1 text-sm ${isConfigured ? '' : 'text-muted-foreground'}`}>
          {summaryText}
        </span>
        <Button variant="ghost" size="sm" onClick={handleOpenDialog}>
          {t('configureButton')}
        </Button>
      </div>

      <CalendarEventConfigDialog
        taskTemplateId={taskTemplateId}
        config={config ?? defaultConfig}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveConfig}
      />
    </>
  );
}

interface CalendarTaskConfigProps {
  taskTemplateId: string;
}

export function CalendarTaskConfig({ taskTemplateId }: CalendarTaskConfigProps) {
  const { configQuery, ...viewProps } = useCalendarTaskConfig(taskTemplateId);
  if (configQuery.isLoading) return <CalendarTaskConfigSkeleton />;
  return <CalendarTaskConfigView {...viewProps} />;
}
