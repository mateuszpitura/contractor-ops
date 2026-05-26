import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const DEFAULT_DAYS = [30, 60, 90];

export function useExpiryReminderDefaults() {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('Settings');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();

  const defaultsQuery = useQuery(trpc.settings.getExpiryReminderDefaults.queryOptions());

  const serverDefaults = defaultsQuery.data?.reminderDaysBefore as number[] | undefined;

  const [inputValue, setInputValue] = useState('');
  const [serverInputValue, setServerInputValue] = useState('');

  useEffect(() => {
    if (serverDefaults) {
      const value = serverDefaults.join(', ');
      setInputValue(value);
      setServerInputValue(value);
    } else if (!defaultsQuery.isLoading) {
      const value = DEFAULT_DAYS.join(', ');
      setInputValue(value);
      setServerInputValue(value);
    }
  }, [serverDefaults, defaultsQuery.isLoading]);

  const isDirty = inputValue !== serverInputValue;

  const updateMutation = useMutation(
    trpc.settings.updateExpiryReminderDefaults.mutationOptions({
      onSuccess: () => {
        toast.success(t('expiryReminders.successToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getExpiryReminderDefaults.queryKey(),
        });
      },
      onError: () => {
        toast.error(tToast('reminderDefaultsFailed'));
      },
    }),
  );

  const handleSave = useCallback(() => {
    const days = inputValue
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n) && n > 0)
      .sort((a, b) => a - b);

    if (days.length === 0) return;

    updateMutation.mutate({
      reminderDaysBefore: days,
    } as Parameters<typeof updateMutation.mutate>[0]);
  }, [inputValue, updateMutation]);

  return {
    id,
    t,
    inputValue,
    setInputValue,
    isDirty,
    isPending: updateMutation.isPending,
    handleSave,
  } as const;
}
