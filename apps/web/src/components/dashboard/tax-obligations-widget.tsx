'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Clock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

function formatMoney(minor: number): string {
  const major = minor / 100;
  return major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function TaxObligationsSkeleton() {
  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TaxObligationsWidget() {
  const t = useTranslations('Dashboard.taxObligations');
  const summaryQuery = useQuery(trpc.tax.taxSummary.queryOptions());

  if (summaryQuery.isLoading) {
    return <TaxObligationsSkeleton />;
  }

  if (!summaryQuery.data) {
    return null;
  }

  const data = summaryQuery.data;

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('vatPeriod')}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('collected')}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.vatCollectedMinor)}</span>
                <Badge
                  variant="outline"
                  className="border-green-500/20 bg-green-500/5 text-green-600 text-xs">
                  <Check className="me-1 h-3 w-3" /> {t('statusFiled')}
                </Badge>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('owed')}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.vatOwedMinor)}</span>
                <Badge
                  variant="outline"
                  className="border-amber-500/20 bg-amber-500/5 text-amber-600 text-xs">
                  <Clock className="me-1 h-3 w-3" /> {t('statusPending')}
                </Badge>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('net')}</span>
              <span className="font-mono font-medium">{formatMoney(data.vatNetMinor)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('whtPeriod')}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('withheld')}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.whtWithheldMinor)}</span>
                <Badge
                  variant="outline"
                  className="border-green-500/20 bg-green-500/5 text-green-600 text-xs">
                  <Check className="me-1 h-3 w-3" />{' '}
                  {t('certsPattern', { count: data.whtCertCount })}
                </Badge>
              </span>
            </div>
            {data.whtPendingMinor > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('pending')}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{formatMoney(data.whtPendingMinor)}</span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/20 bg-amber-500/5 text-amber-600 text-xs">
                    <AlertCircle className="me-1 h-3 w-3" />{' '}
                    {t('itemsPattern', { count: data.whtPendingCount })}
                  </Badge>
                </span>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/settings/compliance"
          className="mt-2 inline-block text-sm text-primary hover:underline">
          {t('viewDetails')} &rarr;
        </Link>
      </CardContent>
    </Card>
  );
}
