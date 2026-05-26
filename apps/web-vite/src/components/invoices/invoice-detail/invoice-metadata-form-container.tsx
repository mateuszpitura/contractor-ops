import { useFlag } from '../../layout/feature-flag-context.js';
import { useInvoiceMetadataForm } from '../hooks/use-invoice-metadata-form.js';
import { LateInterestCardContainer } from '../late-interest/late-interest-card-container.js';
import { SkontoFormSectionContainer } from '../skonto/skonto-form-section-container.js';
import { InvoiceMetadataForm } from './invoice-metadata-form.js';

type InvoiceMetadataFormContainerProps = {
  invoice: Parameters<typeof InvoiceMetadataForm>[0]['invoice'];
  onSubmittedForMatching?: () => void;
};

// Decision: composition — wires the metadata form with feature-flagged
// LateInterestCardContainer + SkontoFormSectionContainer sidecars driven by
// contractor jurisdiction/business-customer signal. Mounted by InvoiceDetailContainer.
export function InvoiceMetadataFormContainer({
  invoice,
  onSubmittedForMatching,
}: InvoiceMetadataFormContainerProps) {
  const mutations = useInvoiceMetadataForm(invoice.id, onSubmittedForMatching);
  const skontoEnabled = useFlag('payments.skonto-enabled');
  const lateInterestEnabled = useFlag('payments.late-interest-enabled');
  const contractor = invoice.contractor;
  const country = contractor?.countryCode ?? '';
  const isBiz = contractor?.isBusinessCustomer ?? false;

  return (
    <InvoiceMetadataForm
      invoice={invoice}
      mutations={mutations}
      detailSidecars={
        <>
          <LateInterestCardContainer
            invoiceId={invoice.id}
            featureEnabled={lateInterestEnabled}
            contractorCountryCode={country}
            isBusinessCustomer={isBiz}
            currency={invoice.currency}
          />
          <SkontoFormSectionContainer
            invoiceId={invoice.id}
            featureEnabled={skontoEnabled}
            contractorCountryCode={country}
          />
        </>
      }
    />
  );
}
