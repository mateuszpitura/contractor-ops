import type { DateTimeRange } from '@contractor-ops/ui/components/shadcn/date-time-range-picker';
import { useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useOutOfOfficeSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.outOfOffice');
  const { timeFormat } = useDateFormatter();

  const [range, setRange] = useState<DateTimeRange | undefined>(undefined);
  const [reason, setReason] = useState('');

  const setOoo = useResourceMutation(
    trpc.user.setOutOfOffice.mutationOptions({
      onSuccess: () => {
        setRange(undefined);
        setReason('');
      },
    }),
    {
      successMessage: t('toast.saved'),
      invalidate: [trpc.user.pathFilter()],
    },
  );

  const clearOoo = useResourceMutation(trpc.user.clearOutOfOffice.mutationOptions(), {
    successMessage: t('toast.cleared'),
    invalidate: [trpc.user.pathFilter()],
  });

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
