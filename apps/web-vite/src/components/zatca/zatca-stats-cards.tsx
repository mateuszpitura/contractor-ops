import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { useZatcaStatsCards as UseZatcaStatsCards } from './hooks/use-zatca-stats-cards.js';
import { useZatcaStatsCards } from './hooks/use-zatca-stats-cards.js';

export function ZatcaStatsCards() {
  const { isLoading, ...props } = useZatcaStatsCards();
  if (isLoading) return <ZatcaStatsCardsSkeleton />;
  return <ZatcaStatsCardsView {...props} />;
}

export type ZatcaStatsCardsViewProps = Omit<ReturnType<typeof UseZatcaStatsCards>, 'isLoading'>;

export function ZatcaStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[0, 1, 2].map(i => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ZatcaStatsCardsView({
  successRate,
  pending,
  rejected,
  successful,
  total,
  t,
}: ZatcaStatsCardsViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="flex items-start justify-between pt-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('successRate')}
            </p>
            <p className="text-2xl font-semibold">{successRate}%</p>
            <p className="text-xs text-muted-foreground">
              {t('successRateDetail', { successful, total })}
            </p>
          </div>
          <CheckCircle2 className="size-5 text-emerald-500" aria-hidden="true" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start justify-between pt-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('pending')}
            </p>
            <p className="text-2xl font-semibold">{pending}</p>
            <p className="text-xs text-muted-foreground">{t('pendingHint')}</p>
          </div>
          <Clock className="size-5 text-amber-500" aria-hidden="true" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start justify-between pt-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('rejected')}
            </p>
            <p
              className={`text-2xl font-semibold ${
                rejected > 0 ? 'text-destructive' : 'text-foreground'
              }`}>
              {rejected}
            </p>
            <p className="text-xs text-muted-foreground">{t('rejectedHint')}</p>
          </div>
          <AlertTriangle
            className={`size-5 ${rejected > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
            aria-hidden="true"
          />
        </CardContent>
      </Card>
    </div>
  );
}
