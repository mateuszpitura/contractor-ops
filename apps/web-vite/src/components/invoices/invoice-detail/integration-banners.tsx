import type { ComponentProps } from 'react';
import type { PeppolTransmissionResult } from '../../../lib/peppol-trpc.js';
import { PeppolInboundBanner } from '../../peppol/peppol-inbound-banner.js';
import { PeppolQRDisplay } from '../../peppol/peppol-qr-display.js';
import { PeppolTransmissionStatusContainer } from '../../peppol/peppol-transmission-status-container.js';
import { ZatcaSubmissionDetail } from '../../zatca/zatca-submission-detail-container.js';
import type { ZatcaSubmissionResult } from '../../zatca/zatca-trpc.js';
import { KsefDuplicateBanner } from '../ksef-duplicate-banner.js';
import { KsefMetadataSection } from '../ksef-metadata-section.js';
import { SkontoBannerContainer } from '../skonto/skonto-banner-container.js';
import { DuplicateWarning } from './duplicate-warning.js';

export interface InvoiceBannerFlags {
  hasDuplicateFlag: boolean;
  duplicateInvoiceId: string | null;
  isKsefSource: boolean;
  ksefReference: string | null;
  ksefUpoReceipt: string | null;
  isPeppolSource: boolean;
  hasKsefDuplicate: boolean;
  ksefDuplicateId: string | null;
}

export interface InvoiceBannerInvoice {
  invoiceNumber: string;
  source: string;
  sellerTaxId: string | null;
  sellerName: string | null;
  receivedAt: Date | string | null;
  createdAt: Date | string;
  qrCodeBase64: string | null;
}

interface IntegrationBannersProps {
  invoice: InvoiceBannerInvoice;
  flags: InvoiceBannerFlags;
  peppolTransmission: PeppolTransmissionResult | undefined;
  zatcaSubmission: ZatcaSubmissionResult | undefined;
  invoiceId: string;
  duplicateDismiss: { isPending: boolean; onDismiss: () => void };
  skontoEnabled: boolean;
}

type KsefBannerProps = ComponentProps<typeof KsefDuplicateBanner>;

export function IntegrationBanners({
  invoice,
  flags,
  peppolTransmission,
  zatcaSubmission,
  invoiceId,
  duplicateDismiss,
  skontoEnabled,
}: IntegrationBannersProps) {
  const hasPeppolOutbound = peppolTransmission?.direction === 'OUTBOUND';

  const ksefBannerProps: KsefBannerProps | null =
    flags.hasKsefDuplicate && flags.ksefDuplicateId
      ? {
          duplicateInvoiceId: flags.ksefDuplicateId,
          invoiceNumber: invoice.invoiceNumber,
          sellerNip: invoice.sellerTaxId ?? '',
        }
      : null;

  return (
    <>
      <SkontoBannerContainer invoiceId={invoiceId} featureEnabled={skontoEnabled} />
      {ksefBannerProps ? <KsefDuplicateBanner {...ksefBannerProps} /> : null}
      {!!flags.hasDuplicateFlag && (
        <DuplicateWarning
          duplicateInvoiceId={flags.duplicateInvoiceId}
          invoiceNumber={invoice.invoiceNumber}
          isPending={duplicateDismiss.isPending}
          onDismiss={duplicateDismiss.onDismiss}
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
      {!!hasPeppolOutbound && peppolTransmission && (
        <PeppolTransmissionStatusContainer transmission={peppolTransmission} />
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
