/**
 * Tax-obligations widget — VAT + WHT summary for the current period.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { AlertCircle, Check, Clock } from 'lucide-react';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useTaxObligationsWidget } from './hooks/use-tax-obligations-widget.js';

function formatMoney(minor: number): string {
  const major = minor / 100;
  return major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function TaxObligationsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`skel-row-1-${i}`} className="flex items-center justify-between">
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
              <div key={`skel-row-2-${i}`} className="flex items-center justify-between">
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
  const { isLoading, data } = useTaxObligationsWidget();

  if (isLoading) {
    return <TaxObligationsSkeleton />;
  }

  if (!data) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('vatPeriod')}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('collected')}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.vatCollectedMinor)}</span>
                <Badge variant="success" className="text-xs">
                  <Check className="me-1 h-3 w-3" /> {t('statusFiled')}
                </Badge>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('owed')}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatMoney(data.vatOwedMinor)}</span>
                <Badge variant="warning" className="text-xs">
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
                <Badge variant="success" className="text-xs">
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
                  <Badge variant="warning" className="text-xs">
                    <AlertCircle className="me-1 h-3 w-3" />{' '}
                    {t('itemsPattern', { count: data.whtPendingCount })}
                  </Badge>
                </span>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/settings?tab=tax"
          className="mt-2 inline-block text-sm text-primary hover:underline">
          {t('viewDetails')} &rarr;
        </Link>
      </CardContent>
    </Card>
  );
}
