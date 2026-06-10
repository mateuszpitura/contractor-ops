import { useCallback, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSlackSyncButton() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.userMapping.syncUsers');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const syncMutation = useResourceMutation(trpc.integration.syncUsers.mutationOptions(), {
    invalidate: [trpc.integration.listUserMappings.queryKey()],
    successMessage: t('toast.success'),
  });

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
