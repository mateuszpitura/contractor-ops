import {
  SectionLabel,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Inbox } from 'lucide-react';
import { Suspense } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { useEinvoiceImportEnabled } from './hooks/use-einvoice-import-enabled.js';
import { IntakeList } from './intake/intake-list.js';

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5'] as const;

export function InvoiceIntakePage() {
  const locale = useLocale();
  const t = useTranslations('EInvoice.intake');
  const importEnabled = useEinvoiceImportEnabled();
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');

  if (!importEnabled) {
    return <Navigate to={`/${locale}/unauthorized`} replace />;
  }

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <WorkbenchPageHeader title={t('pageTitle')} description={t('pageSubtitle')} />
      <section className={WORKBENCH_TABLE_SECTION_CLASS}>
        <SectionLabel icon={Inbox}>{t('pageTitle')}</SectionLabel>
        <Suspense
          fallback={
            <div className="space-y-2">
              {SKELETON_ROW_KEYS.map(key => (
                <Skeleton key={key} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          }>
          <IntakeList initialStatus={status} />
        </Suspense>
      </section>
    </div>
  );
}
