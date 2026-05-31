/**
 * Phase 78 IDP-06 — sole tRPC boundary for the Okta deprovisioning provider
 * section. Reads per-org Okta deprovisioning status (signoff approval + enabled
 * flag) and drives the enable toggle. Only useTRPC/useQuery/useMutation boundary
 * for the section (Page→Container→Hook→Component).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useOktaProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.okta');
  const queryClient = useQueryClient();

  const statusQuery = useQuery(trpc.okta.getStatus.queryOptions());
  const status = statusQuery.data;

  const mutation = useMutation(
    trpc.okta.setEnabled.mutationOptions({
      onSuccess: () => {
        toast.success(t('toggleSuccess'));
        queryClient.invalidateQueries({ queryKey: trpc.okta.getStatus.queryKey() });
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
