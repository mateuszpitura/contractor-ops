import type { InvoiceStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Inbox, Mail, Upload } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Link } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { enumKey } from '../../lib/enum-key.js';
import { AuditTimelineContainer } from '../approvals/audit-timeline-container.js';
import { ChainTrackerContainer } from '../approvals/chain-tracker-container.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { ReconciliationCard } from '../time/reconciliation-card.js';
import type { ZatcaBadgeStatus } from '../zatca/zatca-status-badge.js';
import { ZatcaStatusBadge } from '../zatca/zatca-status-badge.js';
import { useInvoiceDetailContainer } from './hooks/use-invoice-detail-container.js';
import type { InvoiceBannerInvoice } from './invoice-detail/integration-banners.js';
import { IntegrationBanners } from './invoice-detail/integration-banners.js';
import { InvoiceDetailLayout } from './invoice-detail/invoice-detail-layout.js';
import { InvoiceDetailSkeleton } from './invoice-detail/invoice-detail-skeleton.js';
import { InvoiceDetailTabs } from './invoice-detail/invoice-detail-tabs.js';
import { InvoiceMetadataFormContainer } from './invoice-detail/invoice-metadata-form-container.js';
import { MatchCardContainer } from './invoice-detail/match-card-container.js';
import { PeppolStatusBadge } from './invoice-detail/peppol-status-badge.js';
import { InvoiceOcrSectionContainer } from './invoice-ocr-section-container.js';
import { KsefSourceBadge } from './ksef-badge.js';
import { ReverseChargeBannerContainer } from './reverse-charge-banner-container.js';

const sourceIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MANUAL_UPLOAD: Upload,
  EMAIL_INTAKE: Mail,
};

export function InvoiceDetailContainer() {
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
      <div className="space-y-section-gap">
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
    <div className="space-y-section-gap">
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
              invoice={invoice as unknown as InvoiceBannerInvoice}
              flags={invoiceFlags}
              peppolTransmission={peppolTransmission}
              zatcaSubmission={zatcaSubmission}
              invoiceId={invoiceId}
              duplicateDismiss={duplicateDismiss}
              skontoEnabled={skontoEnabled}
            />

            <MatchCardContainer
              invoice={invoice as unknown as Parameters<typeof MatchCardContainer>[0]['invoice']}
              onMatchConfirmed={handleInvoiceInvalidate}
            />

            {!!reconciliation && (
              <ReconciliationCard
                reconciliation={
                  reconciliation as unknown as Parameters<
                    typeof ReconciliationCard
                  >[0]['reconciliation']
                }
              />
            )}

            {!!invoice.isReverseCharge && (
              <ReverseChargeBannerContainer
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

            {!!invoiceFlags.hasApprovalFlow && <ChainTrackerContainer invoiceId={invoice.id} />}
            {!!invoiceFlags.hasApprovalFlow && <AuditTimelineContainer invoiceId={invoice.id} />}
            {!!documentId && <InvoiceOcrSectionContainer documentId={documentId} />}

            <InvoiceMetadataFormContainer
              invoice={invoice}
              onSubmittedForMatching={handleInvoiceInvalidate}
            />
          </InvoiceDetailLayout>
        }
      />
    </div>
  );
}
