import { AtelierPageHeader } from '@contractor-ops/ui';
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

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { LeitwegIdListCardContainer } from './e-invoicing/leitweg-id-list-card-container.js';
import { PeppolParticipantCardContainer } from './e-invoicing/peppol-participant-card-container.js';

// Decision: composition — orchestrates breadcrumb, page header, log-link CTA, and
// PeppolParticipantCardContainer + LeitwegIdListCardContainer into the e-invoicing
// settings route page.
export function SettingsEInvoicingContainer() {
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
        <AtelierPageHeader title={t('h1')} description={t('subline')} />
        <Button variant="outline" size="sm" render={<Link href="/settings/e-invoicing/log" />}>
          <ScrollText className="me-1.5 h-4 w-4" />
          {tLog('viewLog')}
        </Button>
      </div>

      <div className="space-y-6">
        <PeppolParticipantCardContainer />
        <LeitwegIdListCardContainer />
      </div>
    </div>
  );
}
