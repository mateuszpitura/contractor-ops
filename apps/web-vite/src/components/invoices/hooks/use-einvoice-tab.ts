import type { AppRouter } from '@contractor-ops/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback, useMemo, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { tKey } from '../../../i18n/typed-keys.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
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

type InvoiceById = inferRouterOutputs<AppRouter>['invoice']['getById'];
type RawLifecycle = NonNullable<InvoiceById>['eInvoiceLifecycle'];
type ShapeLifecycle = NonNullable<InvoiceTabData['lifecycle']>;

function toLifecycle(raw: RawLifecycle): InvoiceTabData['lifecycle'] {
  if (!raw) return null;
  return {
    ...raw,
    validationReportSummary:
      raw.validationReportSummary as ShapeLifecycle['validationReportSummary'],
  };
}

export function useEinvoiceTab(data: InvoiceTabData | undefined, invoiceId: string) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const tErr = useTranslations('EInvoice.Errors');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloadXmlPending, setIsDownloadXmlPending] = useState(false);
  const [isDownloadReportPending, setIsDownloadReportPending] = useState(false);

  const fallbackQuery = useQuery({
    ...trpc.invoice.getById.queryOptions({ id: invoiceId }),
    enabled: !data,
  });

  const tabData = useMemo<InvoiceTabData | null>(() => {
    if (data) return data;
    const raw = fallbackQuery.data;
    if (!raw) return null;
    return {
      invoiceId,
      lifecycle: toLifecycle(raw.eInvoiceLifecycle),
      peppolParticipant: null,
      receiverAcceptsXRechnungCii: false,
      leitwegIdValue: null,
      leitwegIdSource: null,
      isPublicSectorBuyer: false,
    };
  }, [data, fallbackQuery.data, invoiceId]);

  const invalidateTargets = useMemo(
    () =>
      [
        { queryKey: ['einvoice', 'listByOrg'] as const },
        trpc.invoice.getById.queryKey({ id: invoiceId }),
        trpc.einvoice.pathFilter(),
      ] as const,
    [invoiceId, trpc.einvoice, trpc.invoice.getById],
  );

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

  const finalizeMutation = useResourceMutation(
    trpc.einvoice.finalize.mutationOptions({
      onSuccess: () => setErrorMessage(null),
      onError: err => handleError(extractErrorCode(err)),
    }),
    {
      invalidate: [...invalidateTargets],
      successMessage: toasts.done(),
      suppressErrorToast: () => true,
    },
  );

  const revalidateMutation = useResourceMutation(
    trpc.einvoice.revalidate.mutationOptions({
      onSuccess: () => setErrorMessage(null),
      onError: err => handleError(extractErrorCode(err)),
    }),
    {
      invalidate: [...invalidateTargets],
      successMessage: toasts.done(),
      suppressErrorToast: () => true,
    },
  );

  const sendMutation = useResourceMutation(
    trpc.einvoice.send.mutationOptions({
      onSuccess: () => setErrorMessage(null),
      onError: err => handleError(extractErrorCode(err)),
    }),
    {
      invalidate: [...invalidateTargets],
      successMessage: t('sendCta'),
      suppressErrorToast: () => true,
    },
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
