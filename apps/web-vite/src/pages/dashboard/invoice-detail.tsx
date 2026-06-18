/**
 * Invoice detail — route shell with inlined page content.
 */

import type { InvoiceStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Inbox, Mail, Upload } from 'lucide-react';
import { Suspense } from 'react';
import { useParams } from 'react-router-dom';

import { AuditTimeline } from '../../components/approvals/audit-timeline.js';
import { ChainTracker } from '../../components/approvals/chain-tracker.js';
import { useInvoiceDetailContainer } from '../../components/invoices/hooks/use-invoice-detail-container.js';
import { IntegrationBanners } from '../../components/invoices/invoice-detail/integration-banners.js';
import { InvoiceDetailLayout } from '../../components/invoices/invoice-detail/invoice-detail-layout.js';
import { InvoiceDetailSkeleton } from '../../components/invoices/invoice-detail/invoice-detail-skeleton.js';
import { InvoiceDetailTabs } from '../../components/invoices/invoice-detail/invoice-detail-tabs.js';
import { InvoiceMetadataForm } from '../../components/invoices/invoice-detail/invoice-metadata-form.js';
import { InvoiceOcrSection } from '../../components/invoices/invoice-detail/invoice-ocr-section.js';
import { MatchCard } from '../../components/invoices/invoice-detail/match-card.js';
import { PeppolStatusBadge } from '../../components/invoices/invoice-detail/peppol-status-badge.js';
import { KsefSourceBadge } from '../../components/invoices/ksef-badge.js';
import { ReverseChargeBanner } from '../../components/invoices/reverse-charge-banner.js';
import { useFlag } from '../../components/layout/feature-flag-context.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { ReconciliationCard } from '../../components/time/reconciliation-card.js';
import type { ZatcaBadgeStatus } from '../../components/zatca/zatca-status-badge.js';
import { ZatcaStatusBadge } from '../../components/zatca/zatca-status-badge.js';
import { Link } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { enumKey } from '../../lib/enum-key.js';

const sourceIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MANUAL_UPLOAD: Upload,
  EMAIL_INTAKE: Mail,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page content render with cohesive loading/error + conditional integration/section UI states
function InvoiceDetailPageContent() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id ?? '';
  const {
    invoice,
    documentId,
    pdfUrl,
    peppolTransmission,
    reconciliation,
    zatcaSubmission,
    handleRetry,
    handleInvoiceInvalidate,
    handleSubmitForApproval,
    isSubmitting,
    isNotFound,
    isLoading,
    isError,
    hasInvoice,
    t,
    duplicateDismiss,
    peppolBadgeTransmission,
    invoiceFlags,
  } = useInvoiceDetailContainer(invoiceId, params.id);
  const skontoEnabled = useFlag('payments.skonto-enabled');

  if (isLoading) {
    return (
      <div className="space-y-section-gap min-w-0">
        <InvoiceDetailSkeleton />
      </div>
    );
  }

  if (isError || !hasInvoice || !invoice || !invoiceFlags) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">
          {isNotFound ? t('detail.notFound') : t('detail.loadError')}
        </h2>
        {isNotFound ? (
          <Button variant="outline" render={<Link href="/invoices" />}>
            {t('detail.backToInvoices')}
          </Button>
        ) : (
          <Button variant="outline" onClick={handleRetry}>
            {t('detail.retry')}
          </Button>
        )}
      </div>
    );
  }

  const statusVariant = statusToVariant('invoice', invoice.status as InvoiceStatusInput);
  const SourceIcon = sourceIconMap[invoice.source] ?? Inbox;

  return (
    <div className="space-y-section-gap min-w-0">
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-[24px] font-semibold leading-tight tracking-tight">
          {invoice.invoiceNumber}
        </h1>
        <AtelierStatusPill variant={statusVariant}>
          {tDynLoose(t, 'status', enumKey(invoice.status))}
        </AtelierStatusPill>
        {invoiceFlags.isKsefSource ? (
          <KsefSourceBadge fetchedAt={invoice.receivedAt} />
        ) : (
          <SourceIcon className="h-4 w-4 text-muted-foreground" />
        )}
        {!!zatcaSubmission && (
          <ZatcaStatusBadge status={zatcaSubmission.zatcaStatus as ZatcaBadgeStatus} />
        )}
        <PeppolStatusBadge transmission={peppolBadgeTransmission} />
      </div>

      <InvoiceDetailTabs
        invoiceId={invoiceId}
        details={
          <InvoiceDetailLayout pdfUrl={pdfUrl}>
            <IntegrationBanners
              invoice={invoice}
              flags={invoiceFlags}
              peppolTransmission={peppolTransmission}
              zatcaSubmission={zatcaSubmission}
              invoiceId={invoiceId}
              duplicateDismiss={duplicateDismiss}
              skontoEnabled={skontoEnabled}
            />

            <MatchCard
              invoice={{
                ...invoice,
                matchResults: invoice.matchResults.map(mr => ({
                  ...mr,
                  matchScore: mr.matchScore == null ? null : Number(mr.matchScore),
                })),
              }}
              onMatchConfirmed={handleInvoiceInvalidate}
            />

            {!!reconciliation && <ReconciliationCard reconciliation={reconciliation} />}

            {!!invoice.isReverseCharge && (
              <ReverseChargeBanner
                invoiceId={invoice.id}
                isReverseCharge={invoice.isReverseCharge}
                onToggle={handleInvoiceInvalidate}
              />
            )}

            {!!invoiceFlags.canSubmitForApproval && (
              <div className="flex justify-end">
                <Button onClick={handleSubmitForApproval} disabled={isSubmitting}>
                  {isSubmitting ? t('detail.submittingForApproval') : t('detail.submitForApproval')}
                </Button>
              </div>
            )}

            {!!invoiceFlags.hasApprovalFlow && <ChainTracker invoiceId={invoice.id} />}
            {!!invoiceFlags.hasApprovalFlow && <AuditTimeline invoiceId={invoice.id} />}
            {!!documentId && <InvoiceOcrSection documentId={documentId} />}

            <InvoiceMetadataForm
              invoice={invoice}
              onSubmittedForMatching={handleInvoiceInvalidate}
            />
          </InvoiceDetailLayout>
        }
      />
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <InvoiceDetailPageContent />
    </Suspense>
  );
}
