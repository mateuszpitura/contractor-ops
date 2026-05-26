import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSkontoFormSection(
  options: { invoiceId?: string; featureEnabled?: boolean } = {},
) {
  const { invoiceId, featureEnabled = false } = options;
  const t = useTranslations('Payments.skonto.form');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const evalQuery = useQuery({
    ...trpc.skonto.evaluateForInvoice.queryOptions({ invoiceId: invoiceId! }),
    enabled: !!(featureEnabled && invoiceId),
  });

  const upsertMutation = useMutation(
    trpc.skonto.upsertForInvoice.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        if (invoiceId) {
          void queryClient.invalidateQueries({
            queryKey: trpc.skonto.evaluateForInvoice.queryKey({ invoiceId }),
          });
        }
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.skonto.deleteForInvoice.mutationOptions({
      onSuccess: () => {
        toast.success(t('deletedToast'));
        if (invoiceId) {
          void queryClient.invalidateQueries({
            queryKey: trpc.skonto.evaluateForInvoice.queryKey({ invoiceId }),
          });
        }
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const onSave = useCallback(
    (values: { percent: number; discountDays: number; netDays: number }) => {
      if (!invoiceId) return;
      upsertMutation.mutate({
        invoiceId,
        percent: values.percent,
        discountDays: values.discountDays,
        netDays: values.netDays,
      });
    },
    [invoiceId, upsertMutation],
  );

  const onDelete = useCallback(() => {
    if (!invoiceId) return;
    deleteMutation.mutate({ invoiceId });
  }, [deleteMutation, invoiceId]);

  return {
    onSave,
    onDelete,
    isSaving: upsertMutation.isPending,
    isDeleting: deleteMutation.isPending,
    invoiceTerm: evalQuery.data?.formTerms?.invoiceTerm ?? null,
    profileDefault: evalQuery.data?.formTerms?.profileDefault ?? null,
  } as const;
}
