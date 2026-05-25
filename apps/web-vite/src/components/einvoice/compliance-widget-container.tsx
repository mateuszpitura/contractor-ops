import { EInvoiceComplianceWidgetView } from './compliance-widget.js';
import { useEinvoiceComplianceWidget } from './hooks/use-einvoice-compliance-widget.js';

export function EInvoiceComplianceWidget() {
  const props = useEinvoiceComplianceWidget();
  return <EInvoiceComplianceWidgetView {...props} />;
}
