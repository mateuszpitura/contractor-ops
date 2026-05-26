import type { DateTimeRange } from '@contractor-ops/ui/components/shadcn/date-time-range-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useOutOfOfficeSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.outOfOffice');
  const queryClient = useQueryClient();
  const { timeFormat } = useDateFormatter();

  const [range, setRange] = useState<DateTimeRange | undefined>(undefined);
  const [reason, setReason] = useState('');

  const setOoo = useMutation(
    trpc.user.setOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.saved'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
        setRange(undefined);
        setReason('');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const clearOoo = useMutation(
    trpc.user.clearOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.cleared'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  const isPending = setOoo.isPending || clearOoo.isPending;
  const isValid = !!range && range.until.getTime() >= range.from.getTime();

  const handleSave = () => {
    if (!(isValid && range)) return;
    setOoo.mutate({
      from: range.from.toISOString(),
      until: range.until.toISOString(),
      reason: reason || undefined,
    });
  };

  return {
    t,
    timeFormat,
    range,
    setRange,
    reason,
    setReason,
    isPending,
    isValid,
    handleSave,
    handleClear: () => clearOoo.mutate(),
    isClearPending: clearOoo.isPending,
    isSavePending: setOoo.isPending,
  } as const;
}
