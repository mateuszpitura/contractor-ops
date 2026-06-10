/**
 * Calendar task config — toggle + summary + "Configure" button for the
 * workflow-task → calendar sync settings. Data layer split into
 * `./hooks/use-calendar-task-config.ts`.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { CalendarEventConfigDialog } from './calendar-event-config-dialog.js';
import type { CalendarTaskConfigType } from '../workflows/hooks/use-calendar-task-config.js';
import { useCalendarTaskConfig } from '../workflows/hooks/use-calendar-task-config.js';

const DURATION_LABELS: Record<string, string> = {
  '30m': '30 min',
  '1h': '1 hour',
  '2h': '2 hours',
  '4h': '4 hours',
  full_day: 'Full day',
};

interface CalendarTaskConfigProps {
  taskTemplateId: string;
}

export function CalendarTaskConfig({ taskTemplateId }: CalendarTaskConfigProps) {
  const t = useTranslations('CalendarSettings');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { config, configQuery, saveMutation, handleToggle, handleSaveConfig } =
    useCalendarTaskConfig(taskTemplateId);

  const handleConfigureClick = useCallback(() => setDialogOpen(true), []);
  const handleDialogSave = useCallback(
    (updated: CalendarTaskConfigType) => handleSaveConfig(updated),
    [handleSaveConfig],
  );

  if (configQuery.isPending) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-9" />
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="ms-auto h-8 w-20" />
      </div>
    );
  }

  const isConfigured = Boolean(config?.titleTemplate);
  const durationLabel = config?.duration
    ? (DURATION_LABELS[config.duration] ?? config.duration)
    : '';
  const summaryText = isConfigured
    ? `${config?.titleTemplate} - ${durationLabel}`
    : t('notConfigured');

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
        <Button variant="ghost" size="sm" onClick={handleConfigureClick}>
          {t('configureButton')}
        </Button>
      </div>

      <CalendarEventConfigDialog
        taskTemplateId={taskTemplateId}
        config={
          config ?? {
            calendarEnabled: false,
            duration: '1h' as const,
            attendees: [],
          }
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleDialogSave}
      />
    </>
  );
}
