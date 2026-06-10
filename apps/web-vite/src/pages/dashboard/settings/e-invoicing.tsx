import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@contractor-ops/ui/components/shadcn/breadcrumb';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ScrollText } from 'lucide-react';
import { Suspense } from 'react';

import { LeitwegIdListCard } from '../../../components/settings/e-invoicing/leitweg-id-list-card.js';
import { PeppolParticipantCard } from '../../../components/settings/e-invoicing/peppol-participant-card.js';
import { WorkbenchPageHeader } from '../../../components/shared/workbench-page-header.js';
import { PageLoadingSpinner } from '../../../components/shared/page-loading-spinner.js';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

function EInvoicingSettingsContent() {
  const t = useTranslations('EInvoice.Settings');
  const tSettings = useTranslations('Settings');
  const tLog = useTranslations('EInvoice.TransmissionsLog');

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">{tSettings('title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('h1')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <WorkbenchPageHeader title={t('h1')} description={t('subline')} />
        <Button variant="outline" size="sm" render={<Link href="/settings/e-invoicing/log" />}>
          <ScrollText className="me-1.5 h-4 w-4" />
          {tLog('viewLog')}
        </Button>
      </div>

      <div className="space-y-6">
        <PeppolParticipantCard />
        <LeitwegIdListCard />
      </div>
    </div>
  );
}

export default function EInvoicingSettingsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <EInvoicingSettingsContent />
    </Suspense>
  );
}
