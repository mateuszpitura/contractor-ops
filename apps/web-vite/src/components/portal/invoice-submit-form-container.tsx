import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import {
  usePortalActiveContracts,
  usePortalInvoiceFileUploadWithOcr,
  usePortalInvoiceSubmission,
} from './hooks/use-portal-invoice-submit.js';
import { InvoiceSubmitForm } from './invoice-submit-form.js';

// Decision: form host — composes 3 hooks (upload+OCR, contracts, submission)
// into a long-lived react-hook-form mounted across every state. Lifting
// isLoading would unmount the form and discard input; no variant flag.
export function InvoiceSubmitFormContainer() {
  const t = useTranslations('Portal.submitInvoice');
  const router = useRouter();
  const uploadBundle = usePortalInvoiceFileUploadWithOcr(t);
  const contractsQuery = usePortalActiveContracts();
  const submission = usePortalInvoiceSubmission(t, uploadBundle.upload, {
    contractId: '',
    invoiceNumber: '',
    issueDate: '',
    dueDate: '',
    netAmount: '',
    grossAmount: '',
  });

  const onNavigateBilling = () => {
    router.push('/settings?tab=billing');
  };

  return (
    <InvoiceSubmitForm
      uploadBundle={uploadBundle}
      contractsQuery={contractsQuery}
      submission={submission}
      onNavigateBilling={onNavigateBilling}
    />
  );
}
