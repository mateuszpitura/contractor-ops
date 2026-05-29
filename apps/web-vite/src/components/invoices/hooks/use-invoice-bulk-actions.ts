import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface InvoiceBulkActionsHandlers {
  onBulkSubmitForMatching: (ids: string[]) => void;
  onBulkVoid: (ids: string[]) => void;
  isSubmittingForMatching: boolean;
  isVoiding: boolean;
}

/**
 * Wires the invoice bulk-action bar to per-row tRPC procedures.
 *
 * The invoice router exposes only single-id `submitForMatching` and
 * `voidInvoice` mutations today, so the hook fans out with `Promise.all`
 * and a single optimistic toast / refetch cycle at the end. Per-row
 * permission and status guards remain server-authoritative — failed
 * rows in a heterogeneous selection surface as a single aggregated toast
 * without aborting the rest of the batch.
 */
export function useInvoiceBulkActions(): InvoiceBulkActionsHandlers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Invoices.bulkActions');

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries(trpc.invoice.pathFilter());
  }, [queryClient, trpc.invoice]);

  const submitMutation = useMutation(trpc.invoice.submitForMatching.mutationOptions());
  const voidMutation = useMutation(trpc.invoice.voidInvoice.mutationOptions());

  const runBatch = useCallback(
    async (ids: string[], mutateOne: (id: string) => Promise<unknown>) => {
      const results = await Promise.allSettled(ids.map(id => mutateOne(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      return { succeeded, failed };
    },
    [],
  );

  const onBulkSubmitForMatching = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      void (async () => {
        const { succeeded, failed } = await runBatch(ids, id => submitMutation.mutateAsync({ id }));
        invalidateList();
        if (succeeded > 0) {
          toast.success(t('submittedToast', { count: succeeded }));
        }
        if (failed > 0) {
          toast.error(t('submitError', { count: failed }));
        }
      })();
    },
    [runBatch, submitMutation, invalidateList, t],
  );

  const onBulkVoid = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      void (async () => {
        const { succeeded, failed } = await runBatch(ids, id => voidMutation.mutateAsync({ id }));
        invalidateList();
        if (succeeded > 0) {
          toast.success(t('voidedToast', { count: succeeded }));
        }
        if (failed > 0) {
          toast.error(t('voidError', { count: failed }));
        }
      })();
    },
    [runBatch, voidMutation, invalidateList, t],
  );

  return {
    onBulkSubmitForMatching,
    onBulkVoid,
    isSubmittingForMatching: submitMutation.isPending,
    isVoiding: voidMutation.isPending,
  };
}
