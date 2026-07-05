import { Users } from 'lucide-react';
import { useMemo } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { numberLocaleTag } from '../saudization/format-locale.js';
import type { ContractEndBuckets, HeadcountBucket } from './hooks/use-hr-headcount.js';
import { useHrHeadcount } from './hooks/use-hr-headcount.js';
import { HrSectionCard, HrSectionError, HrSectionSkeleton } from './hr-section.js';

const EMPLOYMENT_TYPE_KEYS = new Set([
  'FULL_TIME',
  'PART_TIME',
  'FIXED_TERM',
  'TEMPORARY',
  'APPRENTICE',
  'SEASONAL',
]);

const CONTRACT_END_ORDER = ['expiredOrPast', 'soon30', 'soon90', 'later', 'none'] as const;

interface BreakdownRow {
  key: string;
  label: string;
  count: number;
}

export interface HrHeadcountViewProps {
  total: number;
  byDepartment: readonly HeadcountBucket[];
  byJurisdiction: readonly HeadcountBucket[];
  byEmploymentType: readonly HeadcountBucket[];
  byContractEndBucket: ContractEndBuckets;
}

function BreakdownList({ heading, rows }: { heading: string; rows: BreakdownRow[] }) {
  const t = useTranslations('HrDashboard');
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('headcount.noBreakdown')}</p>
      ) : (
        <dl className="divide-y divide-border">
          {rows.map(row => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-2">
              <dt className="min-w-0 truncate text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{row.count}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Presentational headcount breakdown (HR-DASH-01). Props-in → JSX-out. */
export function HrHeadcountView({
  total,
  byDepartment,
  byJurisdiction,
  byEmploymentType,
  byContractEndBucket,
}: HrHeadcountViewProps) {
  const t = useTranslations('HrDashboard');
  const locale = useLocale();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocaleTag(locale)), [locale]);

  const departmentRows = useMemo<BreakdownRow[]>(
    () =>
      byDepartment.map(bucket => ({
        key: bucket.key,
        label: bucket.key === 'unspecified' ? t('headcount.unspecified') : bucket.key,
        count: bucket.count,
      })),
    [byDepartment, t],
  );

  const jurisdictionRows = useMemo<BreakdownRow[]>(
    () =>
      byJurisdiction.map(bucket => ({
        key: bucket.key,
        label: bucket.key === 'unspecified' ? t('headcount.unspecified') : bucket.key,
        count: bucket.count,
      })),
    [byJurisdiction, t],
  );

  const employmentTypeRows = useMemo<BreakdownRow[]>(
    () =>
      byEmploymentType.map(bucket => ({
        key: bucket.key,
        label: EMPLOYMENT_TYPE_KEYS.has(bucket.key)
          ? t(`headcount.employmentType.${bucket.key}`)
          : t('headcount.unspecified'),
        count: bucket.count,
      })),
    [byEmploymentType, t],
  );

  const contractEndRows = useMemo<BreakdownRow[]>(
    () =>
      CONTRACT_END_ORDER.map(key => ({
        key,
        label: t(`headcount.contractEnd.${key}`),
        count: byContractEndBucket[key],
      })).filter(row => row.count > 0),
    [byContractEndBucket, t],
  );

  return (
    <HrSectionCard title={t('headcount.title')} description={t('headcount.description')}>
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{t('headcount.total')}</p>
          <p className="font-display text-3xl font-semibold tabular-nums text-primary">
            {numberFormatter.format(total)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <BreakdownList heading={t('headcount.byDepartment')} rows={departmentRows} />
          <BreakdownList heading={t('headcount.byJurisdiction')} rows={jurisdictionRows} />
          <BreakdownList heading={t('headcount.byEmploymentType')} rows={employmentTypeRows} />
          <BreakdownList heading={t('headcount.byContractEnd')} rows={contractEndRows} />
        </div>
      </div>
    </HrSectionCard>
  );
}

export function HrHeadcountSection() {
  const t = useTranslations('HrDashboard');
  const headcount = useHrHeadcount();

  if (headcount.isLoading) return <HrSectionSkeleton title={t('headcount.title')} />;
  if (headcount.isError) {
    return (
      <HrSectionError
        title={t('headcount.title')}
        heading={t('loadError.heading')}
        body={t('loadError.body')}
        retryLabel={t('loadError.retry')}
        onRetry={headcount.onRetry}
      />
    );
  }
  if (headcount.isEmpty) {
    return (
      <HrSectionCard title={t('headcount.title')} description={t('headcount.description')}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Users aria-hidden="true" className="size-7 text-muted-foreground" />
          <p className="text-base font-semibold">{t('headcount.empty.heading')}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t('headcount.empty.body')}</p>
        </div>
      </HrSectionCard>
    );
  }

  return (
    <HrHeadcountView
      total={headcount.total}
      byDepartment={headcount.byDepartment}
      byJurisdiction={headcount.byJurisdiction}
      byEmploymentType={headcount.byEmploymentType}
      byContractEndBucket={headcount.byContractEndBucket}
    />
  );
}
