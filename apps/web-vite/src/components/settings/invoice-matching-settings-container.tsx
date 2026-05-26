import { useInvoiceMatchingSettings } from './hooks/use-invoice-matching-settings.js';
import { InvoiceMatchingSettings } from './invoice-matching-settings.js';

// Decision: mutation host — section gated upstream by SettingsIndexContainer (`general`
// tab); hook supplies form state + save handler + isPending consumed inline by the view.
export function InvoiceMatchingSettingsContainer() {
  const settings = useInvoiceMatchingSettings();
  return <InvoiceMatchingSettings {...settings} />;
}
