import { EInvoiceComplianceDetailView } from './compliance-detail.js';
import { useEinvoiceComplianceDetail } from './hooks/use-einvoice-compliance-detail.js';

export function EInvoiceComplianceDetail() {
  const props = useEinvoiceComplianceDetail();
  return <EInvoiceComplianceDetailView {...props} />;
}
