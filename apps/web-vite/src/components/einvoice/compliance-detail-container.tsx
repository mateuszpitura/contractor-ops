import {
  EInvoiceComplianceDetailEmpty,
  EInvoiceComplianceDetailSkeleton,
  EInvoiceComplianceDetailView,
} from './compliance-detail.js';
import { useEinvoiceComplianceDetail } from './hooks/use-einvoice-compliance-detail.js';

export function EInvoiceComplianceDetail() {
  const props = useEinvoiceComplianceDetail();

  if (props.isLoading) return <EInvoiceComplianceDetailSkeleton />;
  if (props.statuses.length === 0) return <EInvoiceComplianceDetailEmpty t={props.t} />;
  return <EInvoiceComplianceDetailView {...props} />;
}
