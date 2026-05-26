import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export function useSyncStatusSection() {
  const trpc = useTRPC();
  const t = useTranslations('GoogleWorkspace.sync');
  const queryClient = useQueryClient();

  const syncStatusQuery = useQuery(trpc.googleWorkspace.syncStatus.queryOptions());
  const syncStatus = syncStatusQuery.data;

  const triggerSyncMutation = useMutation({
    ...trpc.googleWorkspace.triggerSync.mutationOptions(),
    onSuccess: () => {
      toast.success(t('syncStarted'));
      void queryClient.invalidateQueries({
        queryKey: trpc.googleWorkspace.syncStatus.queryKey(),
      });
    },
    onError: () => {
      toast.error(t('syncError'));
    },
  });

  const handleTriggerSync = () => {
    (triggerSyncMutation.mutate as () => void)();
  };

  return {
    syncStatusQuery,
    syncStatus,
    triggerSyncMutation,
    handleTriggerSync,
    t,
  } as const;
}
