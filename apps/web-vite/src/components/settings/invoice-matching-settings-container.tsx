// Decision: settings section gated upstream by SettingsIndexContainer (`general` tab). Hook owns
// form state + isPending; view renders the matching configuration form.
import { useInvoiceMatchingSettings } from './hooks/use-invoice-matching-settings.js';
import { InvoiceMatchingSettings } from './invoice-matching-settings.js';

export function InvoiceMatchingSettingsContainer() {
  const settings = useInvoiceMatchingSettings();
  return <InvoiceMatchingSettings {...settings} />;
}
