import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { PeppolTransmissionResult } from '../../../lib/peppol-trpc.js';
import { getPeppolTrpc } from '../../../lib/peppol-trpc.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';
import { useZatcaTrpc } from '../../zatca/hooks/use-zatca-trpc.js';
import type { ZatcaSubmissionResult } from '../../zatca/zatca-trpc.js';

export function useInvoiceDetail(invoiceId: string, breadcrumbId?: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Invoices');
  const peppolTrpc = getPeppolTrpc(trpc);
  const zatcaTrpc = useZatcaTrpc();

  const invoiceQuery = useQuery(trpc.invoice.getById.queryOptions({ id: invoiceId }));
  const invoice = invoiceQuery.data;

  const sourceFile = invoice?.files?.find(
    (f: { role: string; document?: { id: string }; documentId?: string }) =>
      f.role === 'SOURCE_ORIGINAL',
  );
  const documentId = sourceFile?.document?.id ?? sourceFile?.documentId ?? null;
  const pdfUrlQuery = useQuery({
    ...trpc.document.getDownloadUrl.queryOptions({ documentId: documentId ?? '' }),
    enabled: !!documentId,
  });

  const peppolTransmissionQuery = useQuery({
    ...peppolTrpc.getTransmissionByInvoiceId.queryOptions({ invoiceId }),
    enabled: !!invoice,
  });

  const reconciliationQuery = useQuery({
    ...trpc.time.getInvoiceReconciliation.queryOptions({ invoiceId }),
    enabled: !!invoice?.contractId,
  });

  const zatcaSubmissionQuery = useQuery({
    ...zatcaTrpc.getStatus.queryOptions({ invoiceId }),
    enabled: !!invoice,
  });

  useBreadcrumbOverride(breadcrumbId ?? invoiceId, invoice?.invoiceNumber);

  const submitForApproval = useMutation(
    trpc.approval.submitForApproval.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: invoiceId }),
        });
        toast.success(t('detail.submittedForApprovalToast'));
      },
      onError: () => {
        toast.error(t('detail.submitForApprovalError'));
      },
    }),
  );

  const handleRetry = useCallback(() => {
    void invoiceQuery.refetch();
  }, [invoiceQuery]);

  const handleInvoiceInvalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.invoice.getById.queryKey({ id: invoiceId }),
    });
  }, [queryClient, trpc, invoiceId]);

  const handleSubmitForApproval = useCallback(() => {
    if (invoice) submitForApproval.mutate({ invoiceId: invoice.id });
  }, [invoice, submitForApproval]);

  const errorCode = (invoiceQuery.error as { data?: { code?: string } } | null | undefined)?.data
    ?.code;
  const isNotFound = errorCode === 'NOT_FOUND';

  return {
    invoiceQuery,
    invoice,
    documentId,
    pdfUrl: pdfUrlQuery.data?.url ?? null,
    peppolTransmission: peppolTransmissionQuery.data as PeppolTransmissionResult | undefined,
    reconciliation: reconciliationQuery.data,
    zatcaSubmission: zatcaSubmissionQuery.data as ZatcaSubmissionResult | undefined,
    handleRetry,
    handleInvoiceInvalidate,
    handleSubmitForApproval,
    isSubmitting: submitForApproval.isPending,
    isNotFound,
    isLoading: invoiceQuery.isLoading,
    isError: invoiceQuery.isError,
    hasInvoice: Boolean(invoice),
    t,
  } as const;
}
