import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type InvoiceMetadataMutationValues = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  sellerTaxId?: string;
  subtotalMinor: number;
  vatRate?: string;
  vatAmountMinor?: number;
  totalMinor: number;
  withholdingMinor?: number;
  amountToPayMinor: number;
  currency: string;
  sellerBankAccount?: string;
};

function buildUpdatePayload(values: InvoiceMetadataMutationValues, invoiceId: string) {
  return {
    id: invoiceId,
    data: {
      invoiceNumber: values.invoiceNumber,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      servicePeriodStart: values.servicePeriodStart || undefined,
      servicePeriodEnd: values.servicePeriodEnd || undefined,
      sellerTaxId: values.sellerTaxId || undefined,
      subtotalMinor: values.subtotalMinor,
      vatRate: (values.vatRate as '23' | '8' | '5' | '0' | 'ZW' | 'NP') || undefined,
      vatAmountMinor: values.vatAmountMinor,
      totalMinor: values.totalMinor,
      withholdingMinor: values.withholdingMinor,
      amountToPayMinor: values.amountToPayMinor,
      currency: values.currency,
      sellerBankAccount: values.sellerBankAccount || undefined,
    },
  };
}

export function useInvoiceMetadataForm(invoiceId: string, onSubmittedForMatching?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Invoices');

  const invoiceQueryKey = trpc.invoice.getById.queryKey({ id: invoiceId });

  const saveDraftMutation = useResourceMutation(
    trpc.invoice.update.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.invoice.pathFilter());
      },
    }),
    {
      invalidate: [invoiceQueryKey],
      successMessage: t('detail.savedToast'),
      errorMessage: t('detail.saveError'),
    },
  );

  const submitForMatchingMutation = useResourceMutation(
    trpc.invoice.submitForMatching.mutationOptions({
      onSuccess: () => {
        onSubmittedForMatching?.();
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.invoice.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
    {
      invalidate: [invoiceQueryKey],
      successMessage: t('detail.submittedToast'),
      errorMessage: t('detail.submitError'),
    },
  );

  const voidMutation = useResourceMutation(
    trpc.invoice.voidInvoice.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.invoice.pathFilter());
      },
    }),
    {
      invalidate: [invoiceQueryKey],
      successMessage: t('detail.voidedToast'),
      errorMessage: t('detail.voidError'),
    },
  );

  const onSaveDraft = (values: InvoiceMetadataMutationValues) => {
    saveDraftMutation.mutate(buildUpdatePayload(values, invoiceId));
  };

  const onSubmitForMatching = (values: InvoiceMetadataMutationValues) => {
    saveDraftMutation.mutate(buildUpdatePayload(values, invoiceId), {
      onSuccess: () => {
        submitForMatchingMutation.mutate({ id: invoiceId });
      },
    });
  };

  const onVoid = () => {
    voidMutation.mutate({ id: invoiceId });
  };

  return {
    onSaveDraft,
    onSubmitForMatching,
    onVoid,
    isSaving: saveDraftMutation.isPending,
    isSubmittingForMatching: submitForMatchingMutation.isPending,
    isVoiding: voidMutation.isPending,
    isSubmitting: saveDraftMutation.isPending || submitForMatchingMutation.isPending,
  } as const;
}
