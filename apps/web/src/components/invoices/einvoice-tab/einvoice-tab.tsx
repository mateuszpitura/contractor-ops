'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { DownloadZugferdPdfButton } from './download-zugferd-pdf-button';
import { GenerationSection } from './generation-section';
import { LeitwegIdResolvedInline } from './leitweg-id-resolved-inline';
import { TransmissionSection } from './transmission-section';
import type { InvoiceTabData } from './types';
import { ValidationSection } from './validation-section';

interface EInvoiceTabProps {
  /**
   * Explicit hydration data for the tab. When omitted the component reads
   * the current invoice via `trpc.invoice.getById`. Tests supply this
   * prop to avoid mocking the router surface.
   */
  data?: InvoiceTabData;
  invoiceId: string;
}

function openSignedUrl(url: string | undefined | null): void {
  if (!url) return;
  // Open in a new tab so the current tab state (filters, position) is
  // preserved. `noopener,noreferrer` mitigates reverse-tabnabbing.
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Parent E-invoice tab. Composes the three sections + LeitwegIdResolvedInline
 * + all tRPC mutation wiring. Every mutation invalidates
 * `[einvoice, listByOrg]` + the current invoice's getById query so the
 * parent table + the tab both reflect new state atomically.
 *
 * All SVRL content is rendered as text nodes — no dangerouslySetInnerHTML.
 */
export function EInvoiceTab({ data, invoiceId }: EInvoiceTabProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const tErr = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();
  const announcementRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When `data` is injected by tests we skip the tRPC roundtrip.
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
    void queryClient.invalidateQueries({
      queryKey: ['einvoice', 'listByOrg'],
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.invoice.getById.queryKey({ id: invoiceId }),
    });
  }, [invoiceId, queryClient]);

  const handleError = useCallback(
    (errorCode: string | undefined) => {
      const key = (errorCode ?? 'Generic') as Parameters<typeof tErr>[0];
      try {
        setErrorMessage(tErr(key));
      } catch {
        setErrorMessage(tErr('Generic'));
      }
    },
    [tErr],
  );

  // tRPC error shape — narrow helper bypasses the strict generated
  // errorShape type while preserving the single `data?.code` field we read.
  const extractErrorCode = (err: unknown): string | undefined => {
    if (err && typeof err === 'object') {
      const e = err as { data?: { code?: string }; message?: string };
      return e.data?.code ?? e.message;
    }
    return;
  };

  const finalizeMutation = useMutation(
    trpc.einvoice.finalize.mutationOptions({
      // biome-ignore lint/nursery/noJsxPropsBind: callbacks are stable via closure
      onSuccess: result => {
        setErrorMessage(null);
        invalidateAll();
        const r = result as {
          validationStatus?: string;
          validationReport?: { issues?: unknown[] };
        };
        const issueCount = Array.isArray(r.validationReport?.issues)
          ? (r.validationReport?.issues?.length ?? 0)
          : 0;
        const status = r.validationStatus ?? 'VALIDATED';
        if (announcementRef.current) {
          announcementRef.current.textContent = `E-invoice finalized — validation ${status} with ${issueCount} issue(s)`;
        }
      },
      onError: err => handleError(extractErrorCode(err)),
    }),
  );

  const revalidateMutation = useMutation(
    trpc.einvoice.revalidate.mutationOptions({
      onSuccess: () => {
        setErrorMessage(null);
        invalidateAll();
      },
      onError: err => handleError(extractErrorCode(err)),
    }),
  );

  const sendMutation = useMutation(
    trpc.einvoice.send.mutationOptions({
      onSuccess: () => {
        setErrorMessage(null);
        invalidateAll();
        toast.success(t('sendCta'));
      },
      onError: err => handleError(extractErrorCode(err)),
    }),
  );

  // `downloadXml` / `downloadReport` are *queries* (not mutations) — they
  // return a signed R2 URL. We fetch them eagerly on click, then open the
  // signed URL in a new tab. Pending state is tracked locally because the
  // query isn't mounted as a hook.
  const [isDownloadXmlPending, setIsDownloadXmlPending] = useState(false);
  const [isDownloadReportPending, setIsDownloadReportPending] = useState(false);

  const handleDownloadXml = useCallback(async () => {
    if (!tabData?.lifecycle) return;
    setIsDownloadXmlPending(true);
    try {
      const result = (await queryClient.fetchQuery(
        trpc.einvoice.downloadXml.queryOptions({ lifecycleId: tabData.lifecycle.id }),
      )) as { url?: string };
      openSignedUrl(result?.url);
    } catch (err) {
      handleError(extractErrorCode(err));
    } finally {
      setIsDownloadXmlPending(false);
    }
  }, [handleError, queryClient, tabData?.lifecycle]);

  const handleDownloadReport = useCallback(async () => {
    if (!tabData?.lifecycle) return;
    setIsDownloadReportPending(true);
    try {
      const result = (await queryClient.fetchQuery(
        trpc.einvoice.downloadReport.queryOptions({ lifecycleId: tabData.lifecycle.id }),
      )) as { url?: string };
      openSignedUrl(result?.url);
    } catch (err) {
      handleError(extractErrorCode(err));
    } finally {
      setIsDownloadReportPending(false);
    }
  }, [handleError, queryClient, tabData?.lifecycle]);

  const handleFinalize = useCallback(() => {
    finalizeMutation.mutate({ invoiceId });
  }, [finalizeMutation, invoiceId]);

  const handleRevalidate = useCallback(() => {
    if (!tabData?.lifecycle) return;
    revalidateMutation.mutate({ lifecycleId: tabData.lifecycle.id });
  }, [revalidateMutation, tabData?.lifecycle]);

  const handleSend = useCallback(() => {
    sendMutation.mutate({ invoiceId });
  }, [sendMutation, invoiceId]);

  // Loading — skeleton placeholders matching UI-SPEC sizes.
  if (!data && fallbackQuery.isLoading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!tabData) return null;

  return (
    <div className="space-y-12" data-slot="einvoice-tab">
      <div ref={announcementRef} aria-live="polite" role="status" className="sr-only" />

      {errorMessage ? (
        <Alert variant="destructive" data-slot="einvoice-tab-error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {tabData.isPublicSectorBuyer ? (
        <LeitwegIdResolvedInline
          leitwegIdValue={tabData.leitwegIdValue}
          source={tabData.leitwegIdSource ?? 'contractorDefault'}
        />
      ) : null}

      <GenerationSection
        lifecycle={tabData.lifecycle}
        isFinalizePending={finalizeMutation.isPending}
        isDownloadXmlPending={isDownloadXmlPending}
        onFinalize={handleFinalize}
        onDownloadXml={handleDownloadXml}
      />

      <ValidationSection
        lifecycle={tabData.lifecycle}
        isRevalidatePending={revalidateMutation.isPending}
        isDownloadReportPending={isDownloadReportPending}
        onRevalidate={handleRevalidate}
        onDownloadReport={handleDownloadReport}
      />

      <TransmissionSection
        lifecycle={tabData.lifecycle}
        peppolParticipant={tabData.peppolParticipant}
        receiverAcceptsXRechnungCii={tabData.receiverAcceptsXRechnungCii}
        isSendPending={sendMutation.isPending}
        onSend={handleSend}
      />

      {/* Phase 62 — outbound ZUGFeRD section. Always available wherever the
          e-invoice tab is rendered (no feature-flag gating per D-14). */}
      <ZugferdSection invoiceId={invoiceId} lifecycle={tabData.lifecycle} />
    </div>
  );
}

interface ZugferdSectionProps {
  invoiceId: string;
  lifecycle: InvoiceTabData['lifecycle'];
}

function ZugferdSection({ invoiceId, lifecycle }: ZugferdSectionProps) {
  const t = useTranslations('EInvoice.intake');
  const generated = (lifecycle as { zugferdPdfKey?: string | null } | null)?.zugferdPdfKey;
  const generatedAt = (lifecycle as { zugferdGeneratedAt?: Date | string | null } | null)
    ?.zugferdGeneratedAt;

  return (
    <section
      aria-labelledby="zugferd-section-heading"
      data-slot="einvoice-tab-zugferd-section"
      className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 id="zugferd-section-heading" className="font-display text-xl font-semibold">
            {t('zugferdSectionHeading')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('zugferdSectionBody')}</p>
        </div>
        <DownloadZugferdPdfButton invoiceId={invoiceId} />
      </div>
      <p className="text-xs text-muted-foreground">
        {generated && generatedAt
          ? t('generatedOnPattern', { date: String(generatedAt) })
          : t('notYetGenerated')}
      </p>
    </section>
  );
}
