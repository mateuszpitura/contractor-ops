/**
 * Phase 78 IDP-07 — sole tRPC boundary for the GitHub deprovisioning provider
 * section. Reads per-org GitHub deprovisioning status (signoff approval + enabled
 * flag) and drives the enable toggle. Only useTRPC/useQuery/useMutation boundary
 * for the section (Page→Container→Hook→Component).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useGitHubProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.github');
  const queryClient = useQueryClient();

  const statusQuery = useQuery(trpc.github.getStatus.queryOptions());
  const status = statusQuery.data;

  const mutation = useMutation(
    trpc.github.setEnabled.mutationOptions({
      onSuccess: () => {
        toast.success(t('toggleSuccess'));
        queryClient.invalidateQueries({ queryKey: trpc.github.getStatus.queryKey() });
      },
      onError: err => toast.error(err.message || t('toggleFailure')),
    }),
  );

  const onToggle = useCallback(
    (enabled: boolean) => {
      mutation.mutate({ enabled });
    },
    [mutation],
  );

  return {
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    onRetry: () => statusQuery.refetch(),
    flagApproved: status?.flagApproved ?? false,
    enabled: status?.enabled ?? false,
    isToggling: mutation.isPending,
    onToggle,
    t,
  } as const;
}
