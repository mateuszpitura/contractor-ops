import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ZatcaChainEntry, ZatcaChainPage } from '../zatca-trpc.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useZatcaInvoiceChainTable(pageSize = 20) {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.invoiceChain');
  const queryClient = useQueryClient();

  const [pendingResubmit, setPendingResubmit] = useState<{
    invoiceId: string;
    icv: number;
  } | null>(null);

  const chainQuery = useQuery(
    zatcaTrpc.getInvoiceChain.queryOptions({ limit: pageSize }, { refetchInterval: 30_000 }),
  );

  const resubmitMutation = useMutation({
    ...zatcaTrpc.resubmit.mutationOptions(),
    onSuccess: () => {
      toast.success(t('toast.resubmitSuccess'));
      queryClient.invalidateQueries({ queryKey: zatcaTrpc.getInvoiceChain.queryKey() });
      queryClient.invalidateQueries({ queryKey: zatcaTrpc.getComplianceStats.queryKey() });
      queryClient.invalidateQueries({ queryKey: zatcaTrpc.getStatus.queryKey() });
      setPendingResubmit(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.resubmitError'));
    },
  });

  const confirmResubmit = useCallback(() => {
    if (!pendingResubmit) return;
    (resubmitMutation.mutate as unknown as (input: { invoiceId: string }) => void)({
      invoiceId: pendingResubmit.invoiceId,
    });
  }, [pendingResubmit, resubmitMutation]);

  const openResubmitDialog = useCallback((invoiceId: string, icv: number) => {
    setPendingResubmit({ invoiceId, icv });
  }, []);

  const closeResubmitDialog = useCallback(() => {
    setPendingResubmit(null);
  }, []);

  const refetchChain = useCallback(() => {
    void chainQuery.refetch();
  }, [chainQuery]);

  const page = chainQuery.data as ZatcaChainPage | undefined;
  const entries: ZatcaChainEntry[] = page?.entries ?? [];

  return {
    isLoading: chainQuery.isLoading,
    isFetching: chainQuery.isFetching,
    entries,
    pendingResubmit,
    openResubmitDialog,
    closeResubmitDialog,
    confirmResubmit,
    isResubmitPending: resubmitMutation.isPending,
    refetchChain,
    t,
  } as const;
}
