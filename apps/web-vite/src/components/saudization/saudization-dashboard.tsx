import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { AlertTriangle, CalendarClock, Info, Pencil, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { useRtlChartConfig } from '../../hooks/use-rtl-chart-config.js';
import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { numberLocaleTag } from './format-locale.js';
import type {
  NitaqatBand,
  UpsertConfigInput,
  UpsertHeadcountInput,
} from './hooks/use-saudization-config.js';
import type { SaudizationDashboardData } from './hooks/use-saudization-dashboard.js';
import { NitaqatOverrideDialog } from './nitaqat-override-dialog.js';
import { SaudizationConfigDialog } from './saudization-config-dialog.js';

const DONUT_PRIMARY = 'var(--chart-1)';
const DONUT_REMAINDER = 'var(--muted)';

export interface SaudizationDashboardProps {
  dashboard: SaudizationDashboardData;
  /** True when the GULF-10 Nitaqat-threshold catalogue has an org override applied. */
  thresholdsCustom: boolean;
  /** True when the GULF-10 permitted-activity catalogue has an org override applied. */
  permittedActivityCatalogueCustom: boolean;
  onSaveBand: (input: UpsertConfigInput) => void;
  isSavingBand: boolean;
  onSaveHeadcount: (input: UpsertHeadcountInput) => void;
  isSavingHeadcount: boolean;
  onApplyNitaqatOverride: (custom: boolean) => void;
  isApplyingNitaqatOverride: boolean;
  onApplyActivityOverride: (custom: boolean) => void;
  isApplyingActivityOverride: boolean;
}

/**
 * Presentational Saudization dashboard (GULF-05/06). Focal point: the manual
 * nationalisation rate (hero stat, Display role, `tabular-nums`, `text-primary`).
 *
 * Hard constraints from the UI-SPEC / CONTEXT:
 *   - The Nitaqat band is a NEUTRAL `outline` badge with the locked statutory label —
 *     it is NEVER colorized to assert a band judgement (D-12 / Pitfall 8). The system
 *     never auto-computes the band; it is admin-entered only.
 *   - The manual headcount is authoritative; the platform-derived contractor counts
 *     render side-by-side and visually subordinate (`text-muted-foreground`, D-10).
 *   - Charts wrap `useRtlChartConfig` for RTL (D-13). Logical properties only.
 */
export function SaudizationDashboard({
  dashboard,
  thresholdsCustom,
  permittedActivityCatalogueCustom,
  onSaveBand,
  isSavingBand,
  onSaveHeadcount,
  isSavingHeadcount,
  onApplyNitaqatOverride,
  isApplyingNitaqatOverride,
  onApplyActivityOverride,
  isApplyingActivityOverride,
}: SaudizationDashboardProps) {
  const t = useTranslations('Saudization');
  const tBands = useTranslations('Saudization.bands');
  const locale = useLocale();
  const { chartStyle } = useRtlChartConfig();

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

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
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(numberLocaleTag(locale), { dateStyle: 'medium' }),
    [locale],
  );

  const rate = dashboard.nationalisationRate;
  const rateLabel = rate === null ? t('rate.notAvailable') : percentFormatter.format(rate);

  const donutData = useMemo(() => {
    if (rate === null) return [];
    return [
      { key: 'saudi', value: Math.max(0, rate) },
      { key: 'other', value: Math.max(0, 1 - rate) },
    ];
  }, [rate]);

  const bandLabel = dashboard.band ? tBands(dashboard.band as NitaqatBand) : null;
  const bandUpdatedAt = dashboard.bandLastUpdatedAt ? new Date(dashboard.bandLastUpdatedAt) : null;
  const hasOverride = thresholdsCustom || permittedActivityCatalogueCustom;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOverrideDialogOpen(true)}>
            <ShieldAlert aria-hidden="true" className="me-1.5 size-4" />
            {t('actions.manageOverrides')}
          </Button>
          <Button size="sm" onClick={() => setConfigDialogOpen(true)}>
            <Pencil aria-hidden="true" className="me-1.5 size-4" />
            {t('actions.editConfig')}
          </Button>
        </div>
      </div>

      {/* Hero — the manual nationalisation rate is the single focal point. */}
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{t('rate.label')}</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-primary">
              {rateLabel}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-muted-foreground">{t('band.label')}</span>
              {bandLabel ? (
                // Neutral badge ONLY — never colorized to assert a band judgement (D-12).
                <Badge variant="outline" className="font-medium">
                  {bandLabel}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">{t('band.notSet')}</span>
              )}
              {hasOverride ? (
                <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">
                  {t('override.badge')}
                </Badge>
              ) : null}
            </div>
            {bandUpdatedAt ? (
              <p className="text-xs text-muted-foreground">
                {t('band.lastUpdated', { date: dateFormatter.format(bandUpdatedAt) })}
              </p>
            ) : null}
          </div>

          <div className="h-40 w-40 shrink-0" aria-hidden="true">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart style={chartStyle}>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="key"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none">
                    {donutData.map(entry => (
                      <Cell
                        key={entry.key}
                        fill={entry.key === 'saudi' ? DONUT_PRIMARY : DONUT_REMAINDER}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => percentFormatter.format(Number(value))}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      border: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                      backgroundColor: 'var(--color-popover)',
                      color: 'var(--color-popover-foreground)',
                      fontSize: '0.8rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-full border-2 border-dashed border-border text-xs text-muted-foreground">
                {t('rate.noChart')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Persistent manual-nature callout — the band is never auto-computed. */}
      <Alert variant="default" className="border-warning/50 bg-warning/10">
        <Info aria-hidden="true" className="size-4 text-warning" />
        <AlertTitle>{t('manualNature.title')}</AlertTitle>
        <AlertDescription>{t('manualNature.body')}</AlertDescription>
      </Alert>

      {dashboard.quarterlyReentryDue ? (
        <Alert variant="default" className="border-warning/50 bg-warning/10">
          <CalendarClock aria-hidden="true" className="size-4 text-warning" />
          <AlertTitle>{t('quarterly.title')}</AlertTitle>
          <AlertDescription>
            {bandUpdatedAt
              ? t('quarterly.body', { date: dateFormatter.format(bandUpdatedAt) })
              : t('quarterly.bodyNoDate')}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Headcount cross-check — manual numbers authoritative, platform-derived subordinate. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{t('headcount.title')}</CardTitle>
          <CardDescription>{t('headcount.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <HeadcountStat
            label={t('headcount.totalLabel')}
            value={
              dashboard.totalHeadcount === null
                ? '—'
                : numberFormatter.format(dashboard.totalHeadcount)
            }
            subordinateLabel={t('headcount.platformContractors')}
            subordinateValue={numberFormatter.format(dashboard.platformDerived.contractorCount)}
          />
          <HeadcountStat
            label={t('headcount.saudiLabel')}
            value={
              dashboard.saudiHeadcount === null
                ? '—'
                : numberFormatter.format(dashboard.saudiHeadcount)
            }
            subordinateLabel={t('headcount.platformSaudiContractors')}
            subordinateValue={numberFormatter.format(
              dashboard.platformDerived.saudiContractorCount,
            )}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Qiwa-auth coverage gap (D-11 visibility-only). */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{t('qiwa.title')}</CardTitle>
            <CardDescription>{t('qiwa.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.qiwaGapCount > 0 ? (
              <Alert variant="default" className="border-warning/50 bg-warning/10">
                <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
                <AlertTitle className="tabular-nums">
                  {t('qiwa.gapCount', { count: dashboard.qiwaGapCount })}
                </AlertTitle>
                <AlertDescription>{t('qiwa.gapBody')}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">{t('qiwa.empty')}</p>
            )}
          </CardContent>
        </Card>

        {/* Iqama expiry roll-up — reused F1 expiry data. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{t('iqama.title')}</CardTitle>
            <CardDescription>{t('iqama.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.iqamaRollup.total > 0 ? (
              <dl className="divide-y divide-border">
                <IqamaRow
                  label={t('iqama.tracked')}
                  value={dashboard.iqamaRollup.total}
                  formatter={numberFormatter}
                />
                <IqamaRow
                  label={t('iqama.expired')}
                  value={dashboard.iqamaRollup.expired}
                  formatter={numberFormatter}
                />
                <IqamaRow
                  label={t('iqama.expiringSoon')}
                  value={dashboard.iqamaRollup.expiringSoon}
                  formatter={numberFormatter}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t('iqama.empty')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <SaudizationConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        initialBand={(dashboard.band as NitaqatBand | null) ?? null}
        initialSegment={dashboard.industrySegment}
        initialTotalHeadcount={dashboard.totalHeadcount}
        initialSaudiHeadcount={dashboard.saudiHeadcount}
        onSaveBand={onSaveBand}
        isSavingBand={isSavingBand}
        onSaveHeadcount={onSaveHeadcount}
        isSavingHeadcount={isSavingHeadcount}
      />

      <NitaqatOverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        thresholdsCustom={thresholdsCustom}
        permittedActivityCatalogueCustom={permittedActivityCatalogueCustom}
        onApplyNitaqatOverride={onApplyNitaqatOverride}
        isApplyingNitaqatOverride={isApplyingNitaqatOverride}
        onApplyActivityOverride={onApplyActivityOverride}
        isApplyingActivityOverride={isApplyingActivityOverride}
      />
    </div>
  );
}

function HeadcountStat({
  label,
  value,
  subordinateLabel,
  subordinateValue,
}: {
  label: string;
  value: string;
  subordinateLabel: string;
  subordinateValue: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {/* Platform-derived figure is visually subordinate so the manual number wins (D-10). */}
      <p className="text-xs text-muted-foreground tabular-nums">
        {subordinateLabel}: {subordinateValue}
      </p>
    </div>
  );
}

function IqamaRow({
  label,
  value,
  formatter,
}: {
  label: string;
  value: number;
  formatter: Intl.NumberFormat;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{formatter.format(value)}</dd>
    </div>
  );
}
