import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Navigate, useParams } from 'react-router-dom';

import { Link, useLocale } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useEinvoiceImportEnabled } from '../hooks/use-einvoice-import-enabled.js';
import { useInvoiceIntakeDetail } from '../hooks/use-invoice-intake-detail.js';
import { IntakeDetailClient } from './intake-detail-client.js';
import { IntakeDetailSkeleton } from './intake-detail-skeleton.js';

export function IntakeDetailContainer() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations('EInvoice.intake');
  const tInvoices = useTranslations('Invoices');
  const importEnabled = useEinvoiceImportEnabled();
  const { intake, isLoading, isError, isNotFound, hasIntake, handleRetry } = useInvoiceIntakeDetail(
    params.id ?? '',
  );

  if (!importEnabled) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  if (isLoading) {
    return <IntakeDetailSkeleton />;
  }

  if (isError || !hasIntake || !intake) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">
          {isNotFound ? tInvoices('detail.notFound') : tInvoices('detail.loadError')}
        </h2>
        {isNotFound ? (
          <Button variant="outline" render={<Link href="/invoices/intake" />}>
            {t('sidebarImports')}
          </Button>
        ) : (
          <Button variant="outline" onClick={handleRetry}>
            {tInvoices('detail.retry')}
          </Button>
        )}
      </div>
    );
  }

  return <IntakeDetailClient intake={intake as never} pageTitle={t('pageTitle')} />;
}
