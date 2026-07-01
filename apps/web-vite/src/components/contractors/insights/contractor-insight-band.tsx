import { AtelierIntensityProvider } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { AttentionRail } from './attention-rail.js';
import { CompositionStrip } from './composition-strip.js';
import { useContractorInsights } from './hooks/use-contractor-insights.js';

/**
 * Wired insight band for the contractor list — the "visuals" layer. Owns
 * loading / error branching and composes the attention rail + composition
 * strip. Its query is independent of the table's, so a band failure degrades to
 * a retry affordance without taking the table down. Forces `workbench`
 * intensity so atelier primitives (Sparkline) drop their continuous motion.
 */
export function ContractorInsightBand() {
  const t = useTranslations('Contractors');
  const insights = useContractorInsights();

  return (
    <AtelierIntensityProvider value="workbench">
      <section aria-label={t('insights.title')} className="space-y-3">
        {insights.isLoading ? (
          <BandSkeleton />
        ) : insights.isError ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3">
            <p className="text-sm text-muted-foreground">{t('insights.error')}</p>
            <Button variant="outline" size="sm" onClick={insights.onRetry}>
              {t('insights.retry')}
            </Button>
          </div>
        ) : insights.data ? (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
            <div className="p-1.5">
              <AttentionRail attention={insights.data.attention} {...insights.attention} />
            </div>
            <div className="border-t border-border/60 px-3 py-3">
              <CompositionStrip
                composition={insights.data.composition}
                active={insights.activeSegments}
                onToggle={insights.toggleSegment}
              />
            </div>
          </div>
        ) : null}
      </section>
    </AtelierIntensityProvider>
  );
}

const RAIL_SKELETON_KEYS = ['at-risk', 'expiring', 'payment-blocked', 'stalled'] as const;
const ROW_SKELETON_KEYS = ['lifecycle', 'type', 'health'] as const;

function BandSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
      <div className="grid grid-cols-1 gap-1 p-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {RAIL_SKELETON_KEYS.map(key => (
          <Skeleton key={key} className="h-12 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-border/60 px-3 py-3">
        {ROW_SKELETON_KEYS.map(key => (
          <Skeleton key={key} className="h-6 w-2/3 rounded-full" />
        ))}
      </div>
    </div>
  );
}
