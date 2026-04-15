'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Currency formatter for GBP
// ---------------------------------------------------------------------------

function formatGBP(minorAmount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorAmount / 100);
}

// ---------------------------------------------------------------------------
// Dashboard tile: Overdue receivables (UK)
// ---------------------------------------------------------------------------

interface OverdueReceivablesTileProps {
  /** PAY_LATE_INTEREST_ENABLED feature flag value. */
  featureEnabled: boolean;
}

export function OverdueReceivablesTile({ featureEnabled }: OverdueReceivablesTileProps) {
  const t = useTranslations('Payments.dashboard');

  const query = trpc.latePaymentInterest.getForOrg.useQuery(
    { status: 'ACCRUING' },
    { enabled: featureEnabled },
  );

  // Not enabled or no data — don't render
  if (!featureEnabled) return null;

  // Loading
  if (query.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-56" />
        </CardContent>
      </Card>
    );
  }

  const data = query.data;

  // No overdue invoices — tile is hidden (absence = empty state)
  if (!data || data.totalPrincipalMinor === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('overdueTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-display tabular-nums">
          {formatGBP(data.totalPrincipalMinor + data.totalInterestMinor)}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('overdueSubline', {
            principal: formatGBP(data.totalPrincipalMinor),
            interest: formatGBP(data.totalInterestMinor),
          })}
        </p>
        <Link
          href="/invoices?filter=overdue"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline pt-1"
        >
          {t('overdueClickThrough')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
