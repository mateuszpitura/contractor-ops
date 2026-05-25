import {
  EInvoiceComplianceWidgetSkeleton,
  EInvoiceComplianceWidgetView,
} from './compliance-widget.js';
import { useEinvoiceComplianceWidget } from './hooks/use-einvoice-compliance-widget.js';

export function EInvoiceComplianceWidget() {
  const props = useEinvoiceComplianceWidget();

  if (props.isLoading) return <EInvoiceComplianceWidgetSkeleton />;
  if (props.statuses.length === 0 && !props.peppolState) return null;
  return <EInvoiceComplianceWidgetView {...props} />;
}
