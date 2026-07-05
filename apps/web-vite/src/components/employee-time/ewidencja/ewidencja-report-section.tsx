import {
  AtelierEmptyState,
  QueryErrorPanel,
  SectionLabel,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { FileText } from 'lucide-react';

import { useLocale } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { EwidencjaReportView } from './ewidencja-report-view.js';
import { useEwidencja } from './hooks/use-ewidencja.js';

export function EwidencjaReport() {
  const ew = useEwidencja();
  const t = useTranslations('Ewidencja');
  const locale = useLocale();

  if (ew.isError) {
    return (
      <div className={WORKBENCH_TABLE_SECTION_CLASS}>
        <QueryErrorPanel
          message={t('error.message')}
          retryLabel={t('error.retry')}
          onRetry={ew.onRetry}
        />
      </div>
    );
  }

  if (ew.noWorkers) {
    return (
      <div className={WORKBENCH_TABLE_SECTION_CLASS}>
        <AtelierEmptyState
          variant="page"
          icon={FileText}
          heading={t('empty.heading')}
          body={t('empty.body', { employee: '', period: '' })}
          renderAction={() => null}
        />
      </div>
    );
  }

  return (
    <section aria-label={t('sectionLabel')} className={WORKBENCH_TABLE_SECTION_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionLabel icon={FileText}>{t('sectionLabel')}</SectionLabel>
        <Select value={ew.workerId} onValueChange={value => ew.onWorkerChange(value ?? '')}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder={t('sectionLabel')} />
          </SelectTrigger>
          <SelectContent>
            {ew.employeeOptions.map(option => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ew.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <EwidencjaReportView
          periods={ew.periods}
          workerName={ew.workerName}
          onGenerate={ew.onGenerate}
          onRegenerate={ew.onRegenerate}
          isGenerating={ew.isGenerating}
          locale={locale}
        />
      )}
    </section>
  );
}
