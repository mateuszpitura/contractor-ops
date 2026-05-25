import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useDoubleConfirmation } from '../../../hooks/use-double-confirmation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type PaymentRunItem = {
  id: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  failureReason: string | null;
  grossAmountMinor?: number | null;
  whtAmountMinor?: number | null;
  whtRate?: number | null;
  whtTreatyApplied?: boolean | null;
  invoice: { invoiceNumber: string; dueDate: string | null };
  contractor: { id: string; legalName: string };
};

export function usePaymentRunSidePanel(options: {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Payments');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { runId, open, onOpenChange } = options;

  const runQuery = useQuery({
    ...trpc.payment.get.queryOptions({ runId: runId ?? '' }),
    enabled: !!runId && open,
  });

  const run = runQuery.data;
  const safeRunId = runId ?? '';
  const status = (run?.status as string | undefined) ?? '';

  const formatDetectionQuery = useQuery({
    ...trpc.payment.getFormatDetection.queryOptions({ paymentRunId: safeRunId }),
    enabled: !!runId && open && status === 'DRAFT',
  });

  const detectedFormatCounts = useMemo(() => {
    const detections = (formatDetectionQuery.data ?? []) as Array<{ format: string }>;
    const counts: Record<string, number> = {};
    for (const it of detections) {
      const key = it.format || 'UNKNOWN';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [formatDetectionQuery.data]);

  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [['payment', 'get']] });
    void queryClient.invalidateQueries({ queryKey: [['payment', 'list']] });
  }, [queryClient]);

  const markAllPaidMutation = useMutation(
    trpc.payment.markAllPaid.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.allMarkedPaid'));
        invalidateQueries();
      },
      onError: () => toast.error(t('errors.failedToMarkPaid')),
    }),
  );

  const cancelMutation = useMutation(
    trpc.payment.cancel.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.runCancelled'));
        invalidateQueries();
        onOpenChange(false);
      },
      onError: () => toast.error(t('errors.failedToCancel')),
    }),
  );

  const updateItemStatusMutation = useMutation(
    trpc.payment.updateItemStatus.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.itemUpdated'));
        invalidateQueries();
      },
      onError: () => toast.error(t('errors.failedToUpdateItem')),
    }),
  );

  const removeFromRunMutation = useMutation(
    trpc.payment.removeFromRun.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.removedFromRun'));
        invalidateQueries();
      },
      onError: () => toast.error(t('errors.failedToRemove')),
    }),
  );

  const { isConfirming: confirmMarkAll, handleClick: handleMarkAllPaid } = useDoubleConfirmation(
    useCallback(() => {
      if (runId) markAllPaidMutation.mutate({ runId });
    }, [runId, markAllPaidMutation]),
  );

  const handleDownloadExport = useCallback(() => {
    if (!runId) return;
    toast.info(t('toast.downloadHint'));
  }, [runId, t]);

  const onCancelRun = useCallback(() => {
    if (runId) cancelMutation.mutate({ runId });
  }, [runId, cancelMutation]);

  const onUpdateItemStatus = useCallback(
    (itemId: string, itemStatus: 'FAILED' | 'PAID', ref?: string, reason?: string) => {
      updateItemStatusMutation.mutate({
        itemId,
        status: itemStatus,
        paymentReference: ref || undefined,
        failureReason: reason || undefined,
      });
    },
    [updateItemStatusMutation],
  );

  const onRemoveFromRun = useCallback(
    (invoiceId: string) => {
      if (runId) removeFromRunMutation.mutate({ runId, invoiceId });
    },
    [runId, removeFromRunMutation],
  );

  const items = (run?.items ?? []) as unknown as PaymentRunItem[];

  return {
    run,
    items,
    status,
    safeRunId,
    isLoading: runQuery.isLoading && !run,
    detectedFormatCounts,
    showFormatHint: status === 'DRAFT' && open && detectedFormatCounts.length > 0,
    confirmMarkAll,
    handleMarkAllPaid,
    handleDownloadExport,
    onCancelRun,
    onUpdateItemStatus,
    onRemoveFromRun,
    isMarkAllPaidPending: markAllPaidMutation.isPending,
    isCancelPending: cancelMutation.isPending,
    isUpdatingItem: updateItemStatusMutation.isPending,
    isRemovingItem: removeFromRunMutation.isPending,
  } as const;
}
