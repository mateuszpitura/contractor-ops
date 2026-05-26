import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSlackSyncButton() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.userMapping.syncUsers');
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const syncMutation = useMutation(
    trpc.integration.syncUsers.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.success'));
        queryClient.invalidateQueries({
          queryKey: trpc.integration.listUserMappings.queryKey(),
        });
      },
      onError: err => {
        toast.error(err.message);
      },
    }),
  );

  const handleOpenConfirm = useCallback(() => setConfirmOpen(true), []);
  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    syncMutation.mutate();
  }, [syncMutation]);

  return {
    t,
    confirmOpen,
    setConfirmOpen,
    isPending: syncMutation.isPending,
    handleOpenConfirm,
    handleConfirm,
  } as const;
}
