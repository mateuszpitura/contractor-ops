/**
 * Skonto banner.
 */

import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { CheckCircle2 } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useSkontoBanner } from '../hooks/use-skonto-banner.js';

function formatEUR(minorAmount: number): string {
  return formatMinorAsCurrency(minorAmount, 'EUR', 'de-DE');
}

interface SkontoBannerData {
  eligibilityReason: string;
  eligible: boolean;
  discountDeadline?: Date | null;
  discountAmountMinor: number;
  discountedAmountMinor: number;
}

interface SkontoBannerViewProps {
  data: SkontoBannerData;
}

export function SkontoBannerSkeleton() {
  return <Skeleton className="h-10 w-full" />;
}

export function SkontoBannerView({ data }: SkontoBannerViewProps) {
  const t = useTranslations('Payments.skonto');
  const deadline = data.discountDeadline ?? new Date(0);

  if (data.eligible) {
    return (
      <div className="rounded-lg border border-green-600/30 bg-green-600/5 px-4 py-3">
        <p className="text-sm text-green-800 dark:text-green-400 inline-flex items-center gap-1.5">
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

  return (
    <div className="rounded-lg border bg-muted/50 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {t('windowExpiredBanner', { date: deadline })}
      </p>
    </div>
  );
}

interface SkontoBannerProps {
  invoiceId: string;
  featureEnabled: boolean;
}

export function SkontoBanner({ invoiceId, featureEnabled }: SkontoBannerProps) {
  const { isLoading, data } = useSkontoBanner(invoiceId, featureEnabled);

  if (!featureEnabled) return null;
  if (isLoading) return <SkontoBannerSkeleton />;
  if (!data) return null;
  if (data.eligibilityReason === 'NO_SKONTO_CONFIGURED') return null;

  return <SkontoBannerView data={data} />;
}
