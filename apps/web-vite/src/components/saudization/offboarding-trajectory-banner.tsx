import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { numberLocaleTag } from './format-locale.js';
import type { OffboardingTrajectory } from './hooks/use-offboarding-trajectory.js';

export interface OffboardingTrajectoryBannerProps {
  trajectory: OffboardingTrajectory;
}

/**
 * GULF-07 — advisory, non-authoritative, non-gating offboarding band-trajectory banner
 * (D-12). Rendered with the `--warning` (amber) treatment when offboarding is opened for
 * a Saudi-national contract. It surfaces the recorded band verbatim and the current →
 * projected nationalisation rate, with adviser-deferring copy ("Advisory only — verify
 * in Qiwa. The system does not set your band."). It NEVER asserts a projected band, never
 * persists, and renders NO confirm/block/gate action (T-79-07-02). Logical properties only.
 */
export function OffboardingTrajectoryBanner({ trajectory }: OffboardingTrajectoryBannerProps) {
  const t = useTranslations('Saudization.offboardingTrajectory');
  const tBands = useTranslations('Saudization.bands');
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

  // No headcount recorded → nothing meaningful to project; render nothing (advisory only).
  if (trajectory.currentRate === null && trajectory.projectedRate === null) return null;

  const bandLabel = trajectory.currentBand ? tBands(trajectory.currentBand) : t('bandUnknown');
  const currentRate =
    trajectory.currentRate === null
      ? t('rateUnknown')
      : percentFormatter.format(trajectory.currentRate);
  const projectedRate =
    trajectory.projectedRate === null
      ? t('rateUnknown')
      : percentFormatter.format(trajectory.projectedRate);

  return (
    <Alert variant="default" className="border-warning/50 bg-warning/10">
      <AlertTriangle aria-hidden="true" className="size-4 text-warning" />
      <AlertTitle>{t('title')}</AlertTitle>
      <AlertDescription className="space-y-1">
        <p className="tabular-nums">
          {t('projection', { band: bandLabel, rate: currentRate, projectedRate })}
        </p>
        <p className="font-medium">{t('advisory')}</p>
      </AlertDescription>
    </Alert>
  );
}
