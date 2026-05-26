import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

export function PortalInvoiceSubmitSuccessContainer() {
  const t = useTranslations('Portal');
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoiceId');

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-[600px] text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>

        <h1 className="text-xl font-semibold">{t('submitSuccess.title')}</h1>

        <p className="mt-3 text-sm text-muted-foreground">{t('submitSuccess.body')}</p>

        <Card className="mt-6">
          <CardContent className="pt-4">
            <p className="text-sm">{t('submitSuccess.nextStep')}</p>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {invoiceId && (
            <Link href={`/portal/invoices/${invoiceId}`}>
              <Button>{t('submitSuccess.trackStatus')}</Button>
            </Link>
          )}
          <Link href="/portal/invoices/submit">
            <Button variant="outline">{t('submitSuccess.submitAnother')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
