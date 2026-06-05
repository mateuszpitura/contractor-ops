/**
 * Risk distribution tile.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';

import { useTranslations } from '../../../../i18n/useTranslations.js';

export type RiskBucket = 'safe' | 'warning' | 'critical';

export interface RiskDistributionTileProps {
  counts: { safe: number; warning: number; critical: number };
  totalCompleted: number;
}

const TONE_CLASSNAMES: Record<RiskBucket, string> = {
  safe: 'bg-[--success]',
  warning: 'bg-[--warning]',
  critical: 'bg-[--destructive]',
};

function pct(n: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

export function RiskDistributionTile({ counts, totalCompleted }: RiskDistributionTileProps) {
  const t = useTranslations('Classification.polish.dashboard');

  if (totalCompleted === 0) {
    return (
      <div className="flex flex-col gap-2" data-testid="risk-distribution-empty">
        <h3 className="text-sm font-medium text-foreground">{t('riskDistributionTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('riskDistributionEmpty')}</p>
      </div>
    );
  }

  const safePct = pct(counts.safe, totalCompleted);
  const warningPct = pct(counts.warning, totalCompleted);
  const criticalPct = pct(counts.critical, totalCompleted);

  const segments: Array<{ bucket: RiskBucket; count: number; pct: number; label: string }> = [
    { bucket: 'safe', count: counts.safe, pct: safePct, label: t('riskBucketSafe') },
    { bucket: 'warning', count: counts.warning, pct: warningPct, label: t('riskBucketWarning') },
    {
      bucket: 'critical',
      count: counts.critical,
      pct: criticalPct,
      label: t('riskBucketCritical'),
    },
  ];

  const ariaLabel = t('riskDistributionAriaLabel', {
    safePct: Math.round(safePct),
    warningPct: Math.round(warningPct),
    criticalPct: Math.round(criticalPct),
  });

  return (
    <div className="flex flex-col gap-2" data-testid="risk-distribution-tile">
      <h3 className="text-sm font-medium text-foreground">{t('riskDistributionTitle')}</h3>
      <TooltipProvider>
        <div
          role="img"
          aria-label={ariaLabel}
          data-testid="risk-distribution-bar"
          className="flex h-6 w-full overflow-hidden rounded-md bg-muted">
          {segments.map(seg =>
            seg.count > 0 ? (
              <Tooltip key={seg.bucket}>
                <TooltipTrigger
                  aria-label={`${seg.label}: ${seg.count} (${seg.pct}%)`}
                  style={{ width: `${seg.pct}%` }}
                  className={`${TONE_CLASSNAMES[seg.bucket]} h-full cursor-default transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                  data-bucket={seg.bucket}
                  data-count={seg.count}
                />
                <TooltipContent>
                  <span className="font-medium">{seg.label}</span>: {seg.count} ({seg.pct}%)
                </TooltipContent>
              </Tooltip>
            ) : null,
          )}
        </div>
      </TooltipProvider>
      <p className="text-xs text-muted-foreground">{t('riskDistributionTooltipHint')}</p>
    </div>
  );
}
