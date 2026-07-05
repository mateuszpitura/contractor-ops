import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

/**
 * The sole tRPC boundary for the HRIS sync settings surface. Exposes the
 * connection status query plus the connect / disconnect / sync-now / mapping
 * mutations; the container and components stay tRPC-free.
 */
export function useHrisSync() {
  const t = useTranslations('HrisSync');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const statusQuery = useQuery(trpc.hrisSync.getStatus.queryOptions());

  const invalidate = () => queryClient.invalidateQueries(trpc.hrisSync.pathFilter());

  const errorToast = (error: unknown, fallback: string) => {
    toast.error(error instanceof Error ? error.message : fallback);
  };

  const connect = useMutation(
    trpc.hrisSync.connect.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.connected'));
        invalidate();
      },
      onError: error => errorToast(error, t('toast.connectError')),
    }),
  );

  const disconnect = useMutation(
    trpc.hrisSync.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.disconnected'));
        invalidate();
      },
      onError: error => errorToast(error, t('toast.disconnectError')),
    }),
  );

  const syncNow = useMutation(
    trpc.hrisSync.syncNow.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.syncQueued'));
        invalidate();
      },
      onError: error => errorToast(error, t('toast.syncError')),
    }),
  );

  const setMapping = useMutation(
    trpc.hrisSync.setMapping.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.mappingSaved'));
        invalidate();
      },
      onError: error => errorToast(error, t('toast.mappingError')),
    }),
  );

  return {
    t,
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    refetch: statusQuery.refetch,
    connect,
    disconnect,
    syncNow,
    setMapping,
  } as const;
}
