/**
 * Data hook for `calendar-task-config` — fetch + save the calendar
 * sync settings of a workflow task template. Ported alongside
 * `calendar-task-config.tsx` from legacy apps/web (commit 62a97d73).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

interface CalendarTaskConfigType {
  calendarEnabled: boolean;
  titleTemplate?: string;
  duration: '30m' | '1h' | '2h' | '4h' | 'full_day';
  attendees: string[];
}

export function useCalendarTaskConfig(taskTemplateId: string, onSavedToastKey: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const configQuery = useQuery(trpc.calendar.getTaskConfig.queryOptions({ taskTemplateId }));

  const save = useMutation(
    trpc.calendar.saveTaskConfig.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.calendar.getTaskConfig.queryKey({ taskTemplateId }),
        });
        toast.success(toasts.done());
      },
      onError: err => toast.error(err.message),
    }),
  );

  return {
    config: configQuery.data as CalendarTaskConfigType | undefined,
    isLoading: configQuery.isPending,
    isSaving: save.isPending,
    saveToggle: (enabled: boolean, current: CalendarTaskConfigType) =>
      save.mutate({ taskTemplateId, config: { ...current, calendarEnabled: enabled } }),
    saveFull: (updated: CalendarTaskConfigType) =>
      save.mutate(
        { taskTemplateId, config: updated },
        { onSuccess: () => toast.success(onSavedToastKey) },
      ),
  } as const;
}

export type { CalendarTaskConfigType };
