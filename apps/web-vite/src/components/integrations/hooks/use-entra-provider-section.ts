/**
 * Phase 78 IDP-05 — sole tRPC boundary for the Microsoft Entra ID deprovisioning
 * provider section. Reads per-org Entra deprovisioning status (signoff approval +
 * enabled flag) and drives the enable toggle. The hybrid-AD hard-block + CA-policy
 * warning copy is informational here; the live preview/saga UI is Phase 76/77's
 * surface. This hook is the ONLY useTRPC/useQuery/useMutation boundary for the
 * section (Page→Container→Hook→Component, apps/web-vite/ARCHITECTURE.md).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEntraProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.entra');
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();

  const statusQuery = useQuery(trpc.entra.getStatus.queryOptions());
  const status = statusQuery.data;

  const mutation = useMutation(
    trpc.entra.setEnabled.mutationOptions({
      onSuccess: () => {
        toast.success(t('toggleSuccess'));
        queryClient.invalidateQueries({ queryKey: trpc.entra.getStatus.queryKey() });
      },
      onError: err => toast.error(translateError(err)),
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
