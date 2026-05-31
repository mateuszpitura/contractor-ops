import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@contractor-ops/ui/components/shadcn/breadcrumb';
import { useTranslations } from '../../i18n/useTranslations.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { TransmissionsLogCardContainer } from './e-invoicing/transmissions-log-card-container.js';

// Decision: composition — orchestrates breadcrumb, page header, and
// TransmissionsLogCardContainer into the e-invoicing log route page.
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

      <WorkbenchPageHeader title={t('h1')} description={t('subline')} />

      <TransmissionsLogCardContainer />
    </div>
  );
}
