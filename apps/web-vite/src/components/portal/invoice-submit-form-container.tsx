import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import {
  usePortalActiveContracts,
  usePortalInvoiceFileUploadWithOcr,
  usePortalInvoiceSubmission,
} from './hooks/use-portal-invoice-submit.js';
import { InvoiceSubmitForm } from './invoice-submit-form.js';

/**
 * Decision: mutation/form host composing 3 hooks (upload+OCR, contracts,
 * submission). The form is a long-lived `react-hook-form` instance that must
 * remain mounted across every state (idle, contracts loading, uploading,
 * OCR processing, submitting) — pulling `isLoading` out would unmount the
 * form and discard input. Contract picker shows its own inline pulse while
 * `contractsQuery.isLoading`; that is intentional and not a variant pick.
 * No isEmpty/isError viewmodel branches exist at this layer.
 */
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
