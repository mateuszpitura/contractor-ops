'use client';

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Payments.skonto');

  const query = useQuery(
    trpc.skonto.evaluateForInvoice.queryOptions({ invoiceId }, { enabled: featureEnabled }),
  );

  if (!featureEnabled) return null;

  // Loading
  if (query.isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  const data = query.data;
  if (!data) return null;

  // No Skonto configured for this invoice → banner hidden.
  if (data.eligibilityReason === 'NO_SKONTO_CONFIGURED') return null;

  // discountDeadline is non-null whenever a Skonto term resolved (i.e. for
  // ELIGIBLE / PAST_DISCOUNT_WINDOW). The discriminated check above guards
  // the NO_SKONTO_CONFIGURED branch where it can be null.
  const deadline = data.discountDeadline ?? new Date(0);

  // Eligible: discount can be (or was) applied.
  if (data.eligible) {
    return (
      <div className="rounded-lg border border-green-600/30 bg-green-600/5 px-4 py-3">
        <p className="text-sm text-green-700 dark:text-green-400 inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('eligibleBanner', {
            discountAmount: formatEUR(data.discountAmountMinor),
            date: deadline,
            discountedTotal: formatEUR(data.discountedAmountMinor),
          })}
        </p>
      </div>
    );
  }

  // Past discount window.
  return (
    <div className="rounded-lg border bg-muted/50 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {t('windowExpiredBanner', { date: deadline })}
      </p>
    </div>
  );
}
