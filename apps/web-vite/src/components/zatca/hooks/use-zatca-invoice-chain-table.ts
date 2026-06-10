import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ZatcaChainEntry, ZatcaChainPage } from '../zatca-trpc.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useZatcaInvoiceChainTable(pageSize = 20) {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.invoiceChain');

  const [pendingResubmit, setPendingResubmit] = useState<{
    invoiceId: string;
    icv: number;
  } | null>(null);

  const chainQuery = useQuery(
    zatcaTrpc.getInvoiceChain.queryOptions({ limit: pageSize }, { refetchInterval: 30_000 }),
  );

  const resubmitMutation = useResourceMutation(
    zatcaTrpc.resubmit.mutationOptions({
      onSuccess: () => {
        setPendingResubmit(null);
      },
    }),
    {
      invalidate: [
        zatcaTrpc.getInvoiceChain.queryKey(),
        zatcaTrpc.getComplianceStats.queryKey(),
        zatcaTrpc.getStatus.queryKey(),
      ],
      successMessage: t('toast.resubmitSuccess'),
      errorMessage: t('toast.resubmitError'),
    },
  );

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
