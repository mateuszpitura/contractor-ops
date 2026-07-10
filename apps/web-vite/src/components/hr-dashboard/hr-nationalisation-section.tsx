import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Landmark } from 'lucide-react';
import { useMemo } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { numberLocaleTag } from '../saudization/format-locale.js';
import type { NationalisationRollup } from './hooks/use-hr-nationalisation.js';
import { useHrNationalisation } from './hooks/use-hr-nationalisation.js';
import { HrSectionCard, HrSectionError, HrSectionSkeleton } from './hr-section.js';

interface CountryColumnProps {
  titleKey: 'nationalisation.ksa.title' | 'nationalisation.uae.title';
  rollup: NationalisationRollup | undefined;
  percentFormatter: Intl.NumberFormat;
  numberFormatter: Intl.NumberFormat;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CountryColumn({
  titleKey,
  rollup,
  percentFormatter,
  numberFormatter,
}: CountryColumnProps) {
  const t = useTranslations('HrDashboard');

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <h3 className="text-base font-semibold">{t(titleKey)}</h3>

      {rollup ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{t('nationalisation.rate')}</p>
            <p className="font-display text-3xl font-semibold tabular-nums text-primary">
              {rollup.nationalisationRate === null
                ? t('nationalisation.rateNotAvailable')
                : percentFormatter.format(rollup.nationalisationRate)}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-muted-foreground">{t('nationalisation.band')}</span>
              {rollup.band ? (
                // Neutral badge only — the band is read-through, never colorized to
                // assert a judgement (the locked anti-feature).
                <Badge variant="outline" className="font-medium">
                  {rollup.band}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t('nationalisation.bandNotSet')}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stat
              label={t('nationalisation.totalHeadcount')}
              value={
                rollup.totalHeadcount === null ? '—' : numberFormatter.format(rollup.totalHeadcount)
              }
            />
            <Stat
              label={t('nationalisation.nationalHeadcount')}
              value={
                rollup.saudiHeadcount === null ? '—' : numberFormatter.format(rollup.saudiHeadcount)
              }
            />
          </div>

          {rollup.iqamaRollup.total > 0 ? (
            <dl className="divide-y divide-border">
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm text-muted-foreground">
                  {t('nationalisation.iqama.tracked')}
                </dt>
                <dd className="text-sm font-medium tabular-nums">
                  {numberFormatter.format(rollup.iqamaRollup.total)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm text-muted-foreground">
                  {t('nationalisation.iqama.expired')}
                </dt>
                <dd className="text-sm font-medium tabular-nums">
                  {numberFormatter.format(rollup.iqamaRollup.expired)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm text-muted-foreground">
                  {t('nationalisation.iqama.expiringSoon')}
                </dt>
                <dd className="text-sm font-medium tabular-nums">
                  {numberFormatter.format(rollup.iqamaRollup.expiringSoon)}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Landmark aria-hidden="true" className="size-6 text-muted-foreground" />
          <p className="text-sm font-semibold">{t('nationalisation.recordPrompt.heading')}</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t('nationalisation.recordPrompt.body')}
          </p>
        </div>
      )}
    </div>
  );
}

export interface HrNationalisationViewProps {
  ksa: NationalisationRollup | undefined;
  uae: NationalisationRollup | undefined;
}

/** Presentational Gulf nationalisation rollup. Props-in → JSX-out. */
export function HrNationalisationView({ ksa, uae }: HrNationalisationViewProps) {
  const t = useTranslations('HrDashboard');
  const locale = useLocale();

  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(numberLocaleTag(locale), {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocaleTag(locale)), [locale]);

  return (
    <HrSectionCard
      title={t('nationalisation.title')}
      description={t('nationalisation.description')}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CountryColumn
          titleKey="nationalisation.ksa.title"
          rollup={ksa}
          percentFormatter={percentFormatter}
          numberFormatter={numberFormatter}
        />
        <CountryColumn
          titleKey="nationalisation.uae.title"
          rollup={uae}
          percentFormatter={percentFormatter}
          numberFormatter={numberFormatter}
        />
      </div>
    </HrSectionCard>
  );
}

export function HrNationalisationSection() {
  const t = useTranslations('HrDashboard');
  const nationalisation = useHrNationalisation();

  if (nationalisation.isLoading) return <HrSectionSkeleton title={t('nationalisation.title')} />;
  if (nationalisation.isError) {
    return (
      <HrSectionError
        title={t('nationalisation.title')}
        heading={t('loadError.heading')}
        body={t('loadError.body')}
        retryLabel={t('loadError.retry')}
        onRetry={nationalisation.onRetry}
      />
    );
  }

  // Always render both country columns — a missing rollup renders the
  // "record manual headcount" prompt, never a platform-derived rate.
  return <HrNationalisationView ksa={nationalisation.ksa} uae={nationalisation.uae} />;
}
