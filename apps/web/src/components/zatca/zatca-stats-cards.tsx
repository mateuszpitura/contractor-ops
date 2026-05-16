'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ComplianceStats } from './zatca-trpc';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// ZATCA Compliance Stats Cards
// ---------------------------------------------------------------------------

/**
 * Three stat cards summarizing ZATCA submission health for the connected
 * dashboard view. Source: `zatca.getComplianceStats`.
 *
 * 1. Success rate (cleared + reported) / total
 * 2. Pending submissions awaiting ZATCA response
 * 3. Rejected submissions (errors) — should be 0 in steady state
 *
 * The router does not currently return submission-time latency, so we surface
 * `pending` as the closest observability signal alongside success/error rates.
 * The spec asked for "avg response time" — flagged as a follow-up below.
 */
export function ZatcaStatsCards() {
  const t = useTranslations('Zatca.statsCards');

  const statsQuery = useQuery(
    zatcaTrpc.getComplianceStats.queryOptions(undefined, { refetchInterval: 30_000 }),
  );

  if (statsQuery.isLoading) {
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

  const stats = statsQuery.data as ComplianceStats | undefined;
  const total = stats?.total ?? 0;
  const successful = (stats?.cleared ?? 0) + (stats?.reported ?? 0);
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 100;
  const pending = stats?.pending ?? 0;
  const rejected = stats?.rejected ?? 0;

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
