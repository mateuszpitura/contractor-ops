'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Mail, Upload } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { AuditTimeline } from '@/components/approvals/audit-timeline';
import { ChainTracker } from '@/components/approvals/chain-tracker';
import { DuplicateWarning } from '@/components/invoices/invoice-detail/duplicate-warning';
import { InvoiceDetailLayout } from '@/components/invoices/invoice-detail/invoice-detail-layout';
import { InvoiceMetadataForm } from '@/components/invoices/invoice-detail/invoice-metadata-form';
import { MatchCard } from '@/components/invoices/invoice-detail/match-card';
import { KsefSourceBadge } from '@/components/invoices/ksef-badge';
import { KsefDuplicateBanner } from '@/components/invoices/ksef-duplicate-banner';
import { KsefMetadataSection } from '@/components/invoices/ksef-metadata-section';
import { ReverseChargeBanner } from '@/components/invoices/reverse-charge-banner';
import { useBreadcrumbOverride } from '@/components/layout/breadcrumb-context';
import { PeppolInboundBanner } from '@/components/peppol/peppol-inbound-banner';
import { PeppolQRDisplay } from '@/components/peppol/peppol-qr-display';
import { PeppolTransmissionStatus } from '@/components/peppol/peppol-transmission-status';
import { ReconciliationCard } from '@/components/time/reconciliation-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ZatcaBadgeStatus } from '@/components/zatca/zatca-status-badge';
import { ZatcaStatusBadge } from '@/components/zatca/zatca-status-badge';
import { ZatcaSubmissionDetail } from '@/components/zatca/zatca-submission-detail';
import type { ZatcaSubmissionResult } from '@/components/zatca/zatca-trpc';
import { zatcaTrpc } from '@/components/zatca/zatca-trpc';
import type { PeppolTransmissionResult } from '@/lib/peppol-trpc';
import { peppolTrpc } from '@/lib/peppol-trpc';
import { trpc } from '@/trpc/init';
import { enumKey } from '@/lib/enum-key';

// ---------------------------------------------------------------------------
// Status badge config (reuse from columns.tsx pattern)
// ---------------------------------------------------------------------------

const statusBadgeConfig: Record<string, { className: string; label: string }> = {
  RECEIVED: { className: 'bg-muted text-muted-foreground', label: 'RECEIVED' },
  UNDER_REVIEW: {
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    label: 'UNDER_REVIEW',
  },
  MATCHED: {
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    label: 'MATCHED',
  },
  UNMATCHED: {
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'UNMATCHED',
  },
  DISCREPANCY: {
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    label: 'DISCREPANCY',
  },
  APPROVAL_PENDING: {
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    label: 'APPROVAL_PENDING',
  },
  APPROVED: {
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    label: 'APPROVED',
  },
  REJECTED: {
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    label: 'REJECTED',
  },
  READY_FOR_PAYMENT: {
    className: 'bg-primary/10 text-primary',
    label: 'READY_FOR_PAYMENT',
  },
  PAID: { className: 'bg-muted text-muted-foreground', label: 'PAID' },
  VOID: { className: 'bg-muted text-muted-foreground', label: 'VOID' },
};

const sourceIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MANUAL_UPLOAD: Upload,
  EMAIL_INTAKE: Mail,
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[60%_1fr] gap-0 lg:gap-8">
      {/* PDF placeholder */}
      <Skeleton className="h-[300px] lg:h-[calc(100vh-64px)] rounded-lg" />

      {/* Right panel skeleton */}
      <div className="space-y-6 py-4 lg:py-0">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-[240px]" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Match card skeleton */}
        <Skeleton className="h-32 rounded-lg" />

        {/* Form fields skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={`skel-${i}`} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice feature flag derivation (reduces cognitive complexity in render)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveInvoiceFlags(invoice: Record<string, any>) {
  // Duplicate detection
  const flagsArray: string[] = Array.isArray(invoice.flagsJson) ? invoice.flagsJson : [];
  const hasDuplicateFlag = flagsArray.includes('DUPLICATE_SUSPECTED');

  const latestMatchResult = invoice.matchResults?.[0];
  const explanationJson = latestMatchResult?.explanationJson as Record<string, unknown> | null;
  const duplicateInvoiceId = (explanationJson?.duplicateInvoiceId as string) ?? null;

  // Source detection
  const isKsefSource = invoice.source === 'KSEF';
  const ksefReference = invoice.externalInvoiceId as string | null;
  const ksefUpoReceipt = invoice.sourceReference as string | null;
  const isPeppolSource = invoice.source === 'PEPPOL';

  // KSeF duplicate detection (manual invoice with KSeF duplicate)
  const flagsObj =
    typeof invoice.flagsJson === 'object' &&
    invoice.flagsJson !== null &&
    !Array.isArray(invoice.flagsJson)
      ? (invoice.flagsJson as Record<string, unknown>)
      : null;
  const hasKsefDuplicate = flagsObj?.duplicateSource === 'KSEF';
  const ksefDuplicateId = (flagsObj?.duplicateOf as string) ?? null;

  // Approval visibility
  const APPROVAL_STATUSES = new Set(['APPROVAL_PENDING', 'APPROVED', 'REJECTED']);
  const hasApprovalFlow = APPROVAL_STATUSES.has(invoice.status);

  const SUBMIT_BLOCKED_STATUSES = new Set([
    'APPROVAL_PENDING',
    'APPROVED',
    'REJECTED',
    'READY_FOR_PAYMENT',
    'PAID',
  ]);
  const canSubmitForApproval =
    (invoice.matchStatus === 'MATCHED' || invoice.matchStatus === 'MANUALLY_CONFIRMED') &&
    !SUBMIT_BLOCKED_STATUSES.has(invoice.status);

  return {
    hasDuplicateFlag,
    duplicateInvoiceId,
    isKsefSource,
    ksefReference,
    ksefUpoReceipt,
    isPeppolSource,
    hasKsefDuplicate,
    ksefDuplicateId,
    hasApprovalFlow,
    canSubmitForApproval,
  };
}

// ---------------------------------------------------------------------------
// Integration banners sub-component (reduces conditional count in main render)
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: invoice shape from tRPC
function IntegrationBanners({ invoice, flags, peppolTransmission, zatcaSubmission, invoiceId, onInvalidate }: {
  invoice: Record<string, any>;
  flags: ReturnType<typeof deriveInvoiceFlags>;
  peppolTransmission: PeppolTransmissionResult | undefined;
  zatcaSubmission: ZatcaSubmissionResult | undefined;
  invoiceId: string;
  onInvalidate: () => void;
}) {
  const hasPeppolOutbound = peppolTransmission?.direction === 'OUTBOUND';

  return (
    <>
      {!!flags.hasKsefDuplicate && !!flags.ksefDuplicateId && (
        <KsefDuplicateBanner
          duplicateInvoiceId={flags.ksefDuplicateId}
          invoiceNumber={invoice.invoiceNumber}
          sellerNip={invoice.sellerTaxId ?? ''}
        />
      )}
      {flags.hasDuplicateFlag && (
        <DuplicateWarning
          invoiceId={invoice.id}
          duplicateInvoiceId={flags.duplicateInvoiceId}
          invoiceNumber={invoice.invoiceNumber}
          onDismiss={onInvalidate}
        />
      )}
      {!!flags.isKsefSource && !!flags.ksefReference && (
        <KsefMetadataSection
          ksefReference={flags.ksefReference}
          upoReceipt={flags.ksefUpoReceipt}
          fetchedAt={invoice.receivedAt ?? invoice.createdAt}
          source={invoice.source}
        />
      )}
      {!!flags.isPeppolSource && !!peppolTransmission && (
        <PeppolInboundBanner
          senderParticipantId={invoice.sellerTaxId ?? 'Unknown sender'}
          senderName={invoice.sellerName ?? 'Unknown'}
          documentType={peppolTransmission.documentTypeId ?? undefined}
          receivedAt={new Date(peppolTransmission.createdAt)}
        />
      )}
      {!!hasPeppolOutbound && (
        <PeppolTransmissionStatus transmission={peppolTransmission} />
      )}
      {!!invoice.qrCodeBase64 && (flags.isPeppolSource || hasPeppolOutbound) && (
        <PeppolQRDisplay
          qrCodeBase64={invoice.qrCodeBase64}
          invoiceNumber={invoice.invoiceNumber}
        />
      )}
      {!!zatcaSubmission && (
        <ZatcaSubmissionDetail submission={zatcaSubmission} invoiceId={invoiceId} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Aggregates all queries needed for the invoice detail page. */
function useInvoiceDetailQueries(invoiceId: string) {
  const invoiceQuery = useQuery(trpc.invoice.getById.queryOptions({ id: invoiceId }));
  const invoice = invoiceQuery.data;

  // PDF URL
  const sourceFile = invoice?.files?.find(
    (f: { role: string; document?: { id: string }; documentId?: string }) =>
      f.role === 'SOURCE_ORIGINAL',
  );
  const documentId = sourceFile?.document?.id ?? sourceFile?.documentId;
  const pdfUrlQuery = useQuery({
    ...trpc.document.getDownloadUrl.queryOptions({ documentId: documentId ?? '' }),
    enabled: !!documentId,
  });

  // Reconciliation
  const reconciliationQuery = useQuery({
    ...trpc.time.getInvoiceReconciliation.queryOptions({ invoiceId }),
    enabled: !!invoice?.contractId,
  });

  // Peppol
  const peppolTransmissionQuery = useQuery({
    ...peppolTrpc.getTransmissionByInvoiceId.queryOptions({ invoiceId }),
    enabled: !!invoice,
  });

  // ZATCA
  const zatcaSubmissionQuery = useQuery({
    ...zatcaTrpc.getStatus.queryOptions({ invoiceId }),
    enabled: !!invoice,
  });

  return {
    invoiceQuery,
    invoice,
    pdfUrl: pdfUrlQuery.data?.url ?? null,
    reconciliation: reconciliationQuery.data,
    peppolTransmission: peppolTransmissionQuery.data as PeppolTransmissionResult | undefined,
    zatcaSubmission: zatcaSubmissionQuery.data as ZatcaSubmissionResult | undefined,
  };
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('Invoices');
  const queryClient = useQueryClient();

  const {
    invoiceQuery, invoice, pdfUrl,
    reconciliation, peppolTransmission, zatcaSubmission,
  } = useInvoiceDetailQueries(params.id);

  useBreadcrumbOverride(params.id, invoice?.invoiceNumber);

  // Submit for approval mutation
  const submitForApproval = useMutation(
    trpc.approval.submitForApproval.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.invoice.getById.queryKey({ id: params.id }),
        });
        toast.success(t('detail.submittedForApprovalToast'));
      },
      onError: () => {
        toast.error(t('detail.submitForApprovalError'));
      },
    }),
  );

  // Handlers
  const handleRetry = useCallback(() => invoiceQuery.refetch(), [invoiceQuery]);

  const handleInvoiceInvalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.invoice.getById.queryKey({ id: params.id }),
    });
  }, [queryClient, params.id]);

  const handleSubmitForApproval = useCallback(() => {
    if (invoice) submitForApproval.mutate({ invoiceId: invoice.id });
  }, [invoice, submitForApproval]);

  // Loading state
  if (invoiceQuery.isLoading) {
    return (
      <div className="space-y-6">
        <DetailSkeleton />
      </div>
    );
  }

  // Error state
  if (invoiceQuery.isError || !invoice) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">{t('detail.loadError')}</h2>
        <Button variant="outline" onClick={handleRetry}>
          {t('detail.retry')}
        </Button>
      </div>
    );
  }

  const statusConfig = statusBadgeConfig[invoice.status];
  const SourceIcon = sourceIconMap[invoice.source] ?? Inbox;

  // Feature detection flags (extracted for readability)
  const flags = deriveInvoiceFlags(invoice);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold font-mono">{invoice.invoiceNumber}</h1>
        {!!statusConfig && (
          <Badge variant="secondary" className={`gap-1 ${statusConfig.className}`}>
            {t(`status.${enumKey(statusConfig.label)}`)}
          </Badge>
        )}
        {flags.isKsefSource ? (
          <KsefSourceBadge fetchedAt={invoice.receivedAt} />
        ) : (
          <SourceIcon className="h-4 w-4 text-muted-foreground" />
        )}
        {/* ZATCA status badge (Phase 48) */}
        {!!zatcaSubmission && (
          <ZatcaStatusBadge status={zatcaSubmission.zatcaStatus as ZatcaBadgeStatus} />
        )}
      </div>

      {/* Side-by-side layout */}
      <InvoiceDetailLayout pdfUrl={pdfUrl}>
        {/* Integration banners (KSeF, Peppol, ZATCA) */}
        <IntegrationBanners
          invoice={invoice}
          flags={flags}
          peppolTransmission={peppolTransmission}
          zatcaSubmission={zatcaSubmission}
          invoiceId={params.id}
          onInvalidate={handleInvoiceInvalidate}
        />

        {/* Match card */}
        <MatchCard invoice={invoice} onMatchConfirmed={handleInvoiceInvalidate} />

        {/* Time reconciliation card (D-16) */}
        {!!reconciliation && (
          <ReconciliationCard
            reconciliation={
              reconciliation as unknown as Parameters<
                typeof ReconciliationCard
              >[0]['reconciliation']
            }
          />
        )}

        {/* Reverse charge banner (Phase 47) */}
        {!!invoice.isReverseCharge && (
          <ReverseChargeBanner
            invoiceId={invoice.id}
            isReverseCharge={invoice.isReverseCharge}
            onToggle={handleInvoiceInvalidate}
          />
        )}

        {/* Submit for approval button */}
        {!!flags.canSubmitForApproval && (
          <div className="flex justify-end">
            <Button onClick={handleSubmitForApproval} disabled={submitForApproval.isPending}>
              {submitForApproval.isPending
                ? t('detail.submittingForApproval')
                : t('detail.submitForApproval')}
            </Button>
          </div>
        )}

        {/* Chain tracker (per D-04) */}
        {!!flags.hasApprovalFlow && <ChainTracker invoiceId={invoice.id} />}

        {/* Audit timeline (per D-11, D-12, D-13) */}
        {!!flags.hasApprovalFlow && <AuditTimeline invoiceId={invoice.id} />}

        {/* Metadata form */}
        <InvoiceMetadataForm invoice={invoice} onSubmittedForMatching={handleInvoiceInvalidate} />
      </InvoiceDetailLayout>
    </div>
  );
}
