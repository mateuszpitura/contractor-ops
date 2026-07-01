// Read-only informational 1099-K band for the contractor profile.
//
// The platform is not the settlement entity and never issues a 1099-K, so this
// band offers no reporting affordance — it is purely a calm heads-up. SAFE is
// neutral; APPROACHING and OVER stay amber at most, never an alarming red and
// never a role="alert"/error treatment. The band state is written by the
// tracker cron; this surface only reads it.

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { useCallback } from 'react';

import { useFormatter } from '../../i18n/useFormatter.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useForm1099kTracker } from './hooks/use-1099k-tracker.js';

export interface Form1099kBandProps {
  readonly contractorId: string;
  readonly taxYear?: number;
}

type Band = 'SAFE' | 'APPROACHING' | 'OVER';

const BAND_META: Record<Band, { variant: 'secondary' | 'warning'; Icon: LucideIcon }> = {
  SAFE: { variant: 'secondary', Icon: Info },
  APPROACHING: { variant: 'warning', Icon: TrendingUp },
  OVER: { variant: 'warning', Icon: AlertTriangle },
};

function BandSkeleton() {
  const t = useTranslations('Form1099KTracker');
  return (
    <Card aria-busy="true" data-testid="form-1099k-band">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

function BandLoadError({ onReload }: { onReload: () => void }) {
  const t = useTranslations('Form1099KTracker');
  return (
    <Card data-testid="form-1099k-band">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">{t('loadError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={onReload}>
          {t('reload')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function Form1099kBand({ contractorId, taxYear }: Form1099kBandProps) {
  const t = useTranslations('Form1099KTracker');
  const format = useFormatter();
  const { tracker, isPending, isError, refetch } = useForm1099kTracker(contractorId, taxYear);
  const handleReload = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isPending) return <BandSkeleton />;
  if (isError || !tracker) return <BandLoadError onReload={handleReload} />;

  const band = tracker.band as Band;
  const meta = BAND_META[band] ?? BAND_META.SAFE;
  const { Icon } = meta;
  const currency = tracker.threshold?.currency ?? 'USD';

  const amount = format.number(tracker.cumulativePayoutMinor / 100, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  const count = format.number(tracker.transactionCount);
  const thresholdLabel = tracker.threshold
    ? t('thresholdValue', {
        amount: format.number(tracker.threshold.amountThresholdMinor / 100, {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }),
        count: format.number(tracker.threshold.transactionCountThreshold),
      })
    : t('thresholdUnknown');

  const noPayouts = tracker.cumulativePayoutMinor === 0 && tracker.transactionCount === 0;

  return (
    <Card data-testid="form-1099k-band" data-band={band}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
          <span>{t('title')}</span>
          <Badge variant={meta.variant} data-testid="form-1099k-band-badge" data-band={band}>
            <Icon aria-hidden="true" className="size-3" />
            <span>{t(`band.${band}`)}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {noPayouts ? (
          <p className="text-sm text-muted-foreground">
            {t('empty', { taxYear: String(tracker.taxYear) })}
          </p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="font-mono">{amount}</span>
              <span className="text-muted-foreground">{t('across', { count })}</span>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span className="text-muted-foreground">{t('thresholdCaption')}</span>
              <span className="font-mono">{thresholdLabel}</span>
            </p>
            <p className="text-sm text-muted-foreground">{t(`copy.${band}`)}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
