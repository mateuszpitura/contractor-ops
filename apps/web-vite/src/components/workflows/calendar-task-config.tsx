import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useState } from 'react';
import { CalendarEventConfigDialog } from './calendar-event-config-dialog.js';
import type { useCalendarTaskConfig } from './hooks/use-calendar-task-config.js';

type CalendarTaskConfigViewProps = ReturnType<typeof useCalendarTaskConfig>;

export function CalendarTaskConfigView({
  taskTemplateId,
  t,
  configQuery,
  config,
  saveMutation,
  handleToggle,
  handleSaveConfig,
  isConfigured,
  summaryText,
  defaultConfig,
}: CalendarTaskConfigViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-9" />
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="ms-auto h-8 w-20" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Switch
          checked={config?.calendarEnabled ?? false}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onCheckedChange={handleToggle}
          disabled={!isConfigured || saveMutation.isPending}
          aria-label={t('createCalendarEvent')}
        />
        <span className="text-sm">{t('createCalendarEvent')}</span>
        <span className={`flex-1 text-sm ${isConfigured ? '' : 'text-muted-foreground'}`}>
          {summaryText}
        </span>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
          {t('configureButton')}
        </Button>
      </div>

      <CalendarEventConfigDialog
        taskTemplateId={taskTemplateId}
        config={config ?? defaultConfig}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onSave={handleSaveConfig}
      />
    </>
  );
}
