import { useQuery } from '@tanstack/react-query';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface CalendarTaskConfigType {
  calendarEnabled: boolean;
  titleTemplate?: string;
  duration: '30m' | '1h' | '2h' | '4h' | 'full_day';
  attendees: string[];
}

export function useCalendarTaskConfig(taskTemplateId: string) {
  const t = useTranslations('CalendarSettings');
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const configQuery = useQuery(trpc.calendar.getTaskConfig.queryOptions({ taskTemplateId }));
  const config = configQuery.data as CalendarTaskConfigType | undefined;

  const invalidateConfig = [trpc.calendar.getTaskConfig.queryKey({ taskTemplateId })];

  const saveToggleMutation = useResourceMutation(trpc.calendar.saveTaskConfig.mutationOptions(), {
    successMessage: toasts.done(),
    invalidate: invalidateConfig,
  });

  const saveConfigMutation = useResourceMutation(trpc.calendar.saveTaskConfig.mutationOptions(), {
    successMessage: t('eventConfigSaved'),
    invalidate: invalidateConfig,
  });

  const handleToggle = (checked: boolean) => {
    if (!config) return;
    saveToggleMutation.mutate({
      taskTemplateId,
      config: { ...config, calendarEnabled: checked },
    });
  };

  const handleSaveConfig = (updatedConfig: CalendarTaskConfigType) => {
    saveConfigMutation.mutate({ taskTemplateId, config: updatedConfig });
  };

  const isConfigured = !!config?.titleTemplate;
  const durationLabels: Record<string, string> = {
    '30m': '30 min',
    '1h': '1 hour',
    '2h': '2 hours',
    '4h': '4 hours',
    full_day: 'Full day',
  };
  const durationLabel = config?.duration
    ? (durationLabels[config.duration] ?? config.duration)
    : '';
  const summaryText = isConfigured
    ? `${config.titleTemplate} - ${durationLabel}`
    : t('notConfigured');

  const defaultConfig: CalendarTaskConfigType = {
    calendarEnabled: false,
    duration: '1h',
    attendees: [],
  };

  return {
    taskTemplateId,
    t,
    configQuery,
    config,
    saveMutation: {
      isPending: saveToggleMutation.isPending || saveConfigMutation.isPending,
    },
    handleToggle,
    handleSaveConfig,
    isConfigured,
    summaryText,
    defaultConfig,
  } as const;
}
