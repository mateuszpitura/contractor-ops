// Decision: composition — orchestrates breadcrumb, page header, and TransmissionsLogCardContainer
// into the e-invoicing log page. Child card hosts its own variant decisions internally.
import { AtelierPageHeader } from '@contractor-ops/ui';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@contractor-ops/ui/components/shadcn/breadcrumb';

import { useTranslations } from '../../i18n/useTranslations.js';
import { TransmissionsLogCardContainer } from './e-invoicing/transmissions-log-card-container.js';

export function SettingsEInvoicingLogContainer() {
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

      <AtelierPageHeader title={t('h1')} description={t('subline')} />

      <TransmissionsLogCardContainer />
    </div>
  );
}
