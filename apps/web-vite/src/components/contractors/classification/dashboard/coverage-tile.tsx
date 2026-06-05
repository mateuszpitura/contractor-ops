/**
 * Polish classification coverage tile.
 */

import { useTranslations } from '../../../../i18n/useTranslations.js';

export interface CoverageTileProps {
  completed: number;
  total: number;
}

const HEALTHY_THRESHOLD = 0.8;

export function CoverageTile({ completed, total }: CoverageTileProps) {
  const t = useTranslations('Classification.polish.dashboard');

  if (total === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">{t('coverageTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('coverageEmpty')}</p>
      </div>
    );
  }

  const ratio = total === 0 ? 0 : completed / total;
  const percentRounded = Math.round(ratio * 100);
  const isHealthy = ratio >= HEALTHY_THRESHOLD;

  return (
    <div className="flex flex-col gap-2" data-testid="coverage-tile">
      <h3 className="text-sm font-medium text-foreground">{t('coverageTitle')}</h3>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl font-semibold tabular-nums ${isHealthy ? 'text-[--success]' : 'text-foreground'}`}
          data-healthy={isHealthy}>
          {percentRounded}%
        </span>
        <span className="text-sm text-muted-foreground">
          {t('coverageBody', { completed, total })}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={`h-full transition-all ${isHealthy ? 'bg-[--success]' : 'bg-primary'}`} />
      </div>
    </div>
  );
}
