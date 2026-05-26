import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ArrowLeft } from 'lucide-react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { InvoiceSubmitFormContainer } from './invoice-submit-form-container.js';

// Decision: composition — wraps InvoiceSubmitFormContainer with back-link +
// heading + width constraint. Page-level chrome for the portal invoice submit
// flow; only useTranslations beyond layout.
export function PortalInvoiceSubmitContainer() {
  const t = useTranslations('Portal');

  return (
    <div className="space-y-6">
      <Link href="/portal/invoices">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="me-1.5 h-4 w-4" />
          {t('submitInvoice.back')}
        </Button>
      </Link>

      <h1 className="text-xl font-semibold">{t('submitInvoice.title')}</h1>

      <div className="max-w-2xl">
        <InvoiceSubmitFormContainer />
      </div>
    </div>
  );
}
