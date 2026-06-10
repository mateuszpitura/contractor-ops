import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@contractor-ops/ui/components/shadcn/breadcrumb';
import { Suspense } from 'react';

import { TransmissionsLogCard } from '../../../components/settings/e-invoicing/transmissions-log-card.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function EInvoicingLogContent() {
  const t = useTranslations('EInvoice.TransmissionsLog');
  const tSettings = useTranslations('EInvoice.Settings');
  const tCommon = useTranslations('Settings');

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">{tCommon('title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings/e-invoicing">{tSettings('h1')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('breadcrumb')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <WorkbenchPageHeader title={t('h1')} description={t('subline')} />

      <TransmissionsLogCard />
    </div>
  );
}

export default function EInvoicingLogPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EInvoicingLogContent />
    </Suspense>
  );
}
