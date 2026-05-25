import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useExpiryRemindersEditor(contractId: string, currentReminders: number[]) {
  const t = useTranslations('ContractDetail.overview');
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [editing, setEditing] = useState(false);
  const [reminders, setReminders] = useState(currentReminders.join(', '));

  const mutation = useMutation(
    trpc.contract.updateExpiryReminders.mutationOptions({
      onSuccess: () => {
        toast.success(t('reminders.saved'));
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
        setEditing(false);
      },
      onError: () => {
        toast.error(t('reminders.error'));
      },
    }),
  );

  const handleSave = useCallback(() => {
    const parsed = reminders
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n) && n > 0);

    if (parsed.length === 0) return;

    mutation.mutate({
      contractId,
      reminderDaysBefore: parsed,
    });
  }, [contractId, mutation, reminders]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setReminders(currentReminders.join(', '));
  }, [currentReminders]);

  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);

  return {
    editing,
    handleCancel,
    handleSave,
    isPending: mutation.isPending,
    reminders,
    setReminders,
    startEditing,
  } as const;
}
