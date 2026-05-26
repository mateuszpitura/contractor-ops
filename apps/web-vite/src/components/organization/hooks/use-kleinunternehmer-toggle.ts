import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useKleinunternehmerToggle() {
  const t = useTranslations('organization.kleinunternehmer');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const mutation = useMutation(
    trpc.organization.setKleinunternehmer.mutationOptions({
      onSuccess: (result: { isKleinunternehmer: boolean }) => {
        toast.success(
          result.isKleinunternehmer
            ? `${t('toggleLabel')} enabled`
            : `${t('toggleLabel')} disabled`,
        );
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || `Failed to update ${t('toggleLabel')}`);
      },
      onSettled: () => {
        setConfirmOpen(false);
        setPendingValue(null);
      },
    }),
  );

  const handleCheckedChange = (next: boolean) => {
    setPendingValue(next);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingValue !== null) {
      mutation.mutate({ enabled: pendingValue });
    }
  };

  return {
    t,
    confirmOpen,
    setConfirmOpen,
    pendingValue,
    mutation,
    handleCheckedChange,
    handleConfirm,
  } as const;
}
