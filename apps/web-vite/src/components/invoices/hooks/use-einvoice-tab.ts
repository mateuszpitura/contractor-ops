import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { InvoiceTabData } from '../einvoice-tab/types.js';

function extractErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object') {
    const e = err as { data?: { code?: string }; message?: string };
    return e.data?.code ?? e.message;
  }
  return;
}

export function useEinvoiceTab(data: InvoiceTabData | undefined, invoiceId: string) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const tErr = useTranslations('EInvoice.Errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloadXmlPending, setIsDownloadXmlPending] = useState(false);
  const [isDownloadReportPending, setIsDownloadReportPending] = useState(false);

  const fallbackQuery = useQuery({
    ...trpc.invoice.getById.queryOptions({ id: invoiceId }),
    enabled: !data,
  });

  const tabData = useMemo<InvoiceTabData | null>(() => {
    if (data) return data;
    const raw = fallbackQuery.data as { eInvoiceLifecycle?: unknown } | undefined;
    if (!raw) return null;
    return {
      invoiceId,
      lifecycle: (raw.eInvoiceLifecycle as InvoiceTabData['lifecycle']) ?? null,
      peppolParticipant: null,
      receiverAcceptsXRechnungCii: false,
      leitwegIdValue: null,
      leitwegIdSource: null,
      isPublicSectorBuyer: false,
    };
  }, [data, fallbackQuery.data, invoiceId]);

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['einvoice', 'listByOrg'] });
    void queryClient.invalidateQueries({
      queryKey: trpc.invoice.getById.queryKey({ id: invoiceId }),
    });
  }, [invoiceId, queryClient, trpc.invoice.getById]);

  const handleError = useCallback(
    (errorCode: string | undefined) => {
      const key = errorCode ?? 'Generic';
      try {
        setErrorMessage(tKey(tErr, key));
      } catch {
        setErrorMessage(tErr('Generic'));
      }
    },
    [tErr],
  );

  const finalizeMutation = useMutation(
    trpc.einvoice.finalize.mutationOptions({
      onSuccess: _result => {
        setErrorMessage(null);
        invalidateAll();
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.einvoice.pathFilter());
      },
      onError: err => {
        handleError(extractErrorCode(err));
        toast.error(err.message);
      },
    }),
  );

  const revalidateMutation = useMutation(
    trpc.einvoice.revalidate.mutationOptions({
      onSuccess: () => {
        setErrorMessage(null);
        invalidateAll();
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.einvoice.pathFilter());
      },
      onError: err => {
        handleError(extractErrorCode(err));
        toast.error(err.message);
      },
    }),
  );

  const sendMutation = useMutation(
    trpc.einvoice.send.mutationOptions({
      onSuccess: () => {
        setErrorMessage(null);
        invalidateAll();
        toast.success(t('sendCta'));
        queryClient.invalidateQueries(trpc.einvoice.pathFilter());
      },
      onError: err => {
        handleError(extractErrorCode(err));
        toast.error(err.message);
      },
    }),
  );

  const handleDownloadXml = useCallback(async () => {
    if (!tabData?.lifecycle) return;
    setIsDownloadXmlPending(true);
    try {
      const result = (await queryClient.fetchQuery(
        trpc.einvoice.downloadXml.queryOptions({ lifecycleId: tabData.lifecycle.id }),
      )) as { url?: string };
      if (result?.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      handleError(extractErrorCode(err));
    } finally {
      setIsDownloadXmlPending(false);
    }
  }, [handleError, queryClient, tabData?.lifecycle, trpc.einvoice.downloadXml]);

  const handleDownloadReport = useCallback(async () => {
    if (!tabData?.lifecycle) return;
    setIsDownloadReportPending(true);
    try {
      const result = (await queryClient.fetchQuery(
        trpc.einvoice.downloadReport.queryOptions({ lifecycleId: tabData.lifecycle.id }),
      )) as { url?: string };
      if (result?.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      handleError(extractErrorCode(err));
    } finally {
      setIsDownloadReportPending(false);
    }
  }, [handleError, queryClient, tabData?.lifecycle, trpc.einvoice.downloadReport]);

  const onFinalize = useCallback(() => {
    finalizeMutation.mutate({ invoiceId });
  }, [finalizeMutation, invoiceId]);

  const onRevalidate = useCallback(() => {
    if (!tabData?.lifecycle) return;
    revalidateMutation.mutate({ lifecycleId: tabData.lifecycle.id });
  }, [revalidateMutation, tabData?.lifecycle]);

  const onSend = useCallback(() => {
    sendMutation.mutate({ invoiceId });
  }, [invoiceId, sendMutation]);

  return {
    isLoading: !data && fallbackQuery.isLoading,
    tabData,
    errorMessage,
    isFinalizePending: finalizeMutation.isPending,
    isRevalidatePending: revalidateMutation.isPending,
    isSendPending: sendMutation.isPending,
    isDownloadXmlPending,
    isDownloadReportPending,
    onFinalize,
    onRevalidate,
    onSend,
    onDownloadXml: handleDownloadXml,
    onDownloadReport: handleDownloadReport,
  } as const;
}
