import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSkontoApply(options: {
  paymentRunItemId: string;
  onSkontoToggle?: (itemId: string, applied: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();
  const [applied, setApplied] = useState(false);

  const applyMutation = useMutation(
    trpc.payment.applySkontoToItem.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.payment.pathFilter());
        toast.success(toasts.done());
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
        setApplied(prev => !prev);
        options.onSkontoToggle?.(options.paymentRunItemId, !applied);
      },
    }),
  );

  const handleToggle = useCallback(
    (checked: boolean) => {
      setApplied(!!checked);
      options.onSkontoToggle?.(options.paymentRunItemId, !!checked);
      applyMutation.mutate({ paymentRunItemId: options.paymentRunItemId });
    },
    [options, applyMutation],
  );

  return {
    applied,
    handleToggle,
    isPending: applyMutation.isPending,
  } as const;
}
