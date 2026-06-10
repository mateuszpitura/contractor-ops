import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSkontoFormSection(
  options: { invoiceId?: string; featureEnabled?: boolean } = {},
) {
  const { invoiceId, featureEnabled = false } = options;
  const t = useTranslations('Payments.skonto.form');
  const trpc = useTRPC();

  const skontoInvalidate = useMemo(
    () => (invoiceId ? [trpc.skonto.evaluateForInvoice.queryKey({ invoiceId })] : []),
    [invoiceId, trpc.skonto],
  );

  const evalQuery = useQuery({
    ...trpc.skonto.evaluateForInvoice.queryOptions({ invoiceId: invoiceId! }),
    enabled: !!(featureEnabled && invoiceId),
  });

  const upsertMutation = useResourceMutation(trpc.skonto.upsertForInvoice.mutationOptions(), {
    invalidate: skontoInvalidate,
    successMessage: t('savedToast'),
  });

  const deleteMutation = useResourceMutation(trpc.skonto.deleteForInvoice.mutationOptions(), {
    invalidate: skontoInvalidate,
    successMessage: t('deletedToast'),
  });

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
