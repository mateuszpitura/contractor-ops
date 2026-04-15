'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Currency formatter for EUR
// ---------------------------------------------------------------------------

function formatEUR(minorAmount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorAmount / 100);
}

// ---------------------------------------------------------------------------
// Invoice detail Skonto banner
// ---------------------------------------------------------------------------

interface SkontoBannerProps {
  invoiceId: string;
  /** PAY_SKONTO_ENABLED feature flag value. */
  featureEnabled: boolean;
}

export function SkontoBanner({ invoiceId, featureEnabled }: SkontoBannerProps) {
  const t = useTranslations('Payments.skonto.banner');

  const query = trpc.skonto.evaluateForInvoice.useQuery(
    { invoiceId },
    { enabled: featureEnabled },
  );

  if (!featureEnabled) return null;

  // Loading
  if (query.isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  const data = query.data;
  if (!data) return null;

  // NO_SKONTO_CONFIGURED — banner hidden
  if (data.state === 'NO_SKONTO_CONFIGURED') return null;

  // ELIGIBLE
  if (data.state === 'ELIGIBLE') {
    return (
      <div className="rounded-lg border border-green-600/30 bg-green-600/5 px-4 py-3">
        <p className="text-sm text-green-700 dark:text-green-400">
          {t('eligible', {
            discountAmount: formatEUR(data.discountAmountMinor),
            date: data.discountDeadline,
            discountedTotal: formatEUR(data.discountedTotalMinor),
          })}
        </p>
      </div>
    );
  }

  // PAST_DISCOUNT_WINDOW
  if (data.state === 'PAST_DISCOUNT_WINDOW') {
    return (
      <div className="rounded-lg border bg-muted/50 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {t('pastWindow', { date: data.discountDeadline })}
        </p>
      </div>
    );
  }

  // TAKEN_AT_PAYMENT
  if (data.state === 'TAKEN_AT_PAYMENT') {
    return (
      <div className="rounded-lg border border-green-600/30 bg-green-600/5 px-4 py-3">
        <p className="text-sm text-green-700 dark:text-green-400 inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('takenAtPayment', {
            discountAmount: formatEUR(data.discountAmountMinor),
            paidDate: data.paidDate,
          })}
        </p>
      </div>
    );
  }

  // NOT_TAKEN_AT_PAYMENT
  if (data.state === 'NOT_TAKEN_AT_PAYMENT') {
    return (
      <div className="rounded-lg border bg-muted/50 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {t('notTakenAtPayment')}
        </p>
      </div>
    );
  }

  return null;
}
