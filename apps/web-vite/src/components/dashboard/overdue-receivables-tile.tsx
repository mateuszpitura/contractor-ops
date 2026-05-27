/**
 * Overdue receivables tile — UK LPCDA outstanding interest accruals.
 * Visibility gated by the `PAY_LATE_INTEREST_ENABLED` feature flag (the
 * tile self-renders nothing when disabled or when there are no
 * outstanding accruals).
 *
 * Ported from legacy `apps/web/src/components/dashboard/overdue-receivables-tile.tsx`
 * (commit 62a97d73). Data layer split into
 * `./hooks/use-overdue-receivables-tile.ts`.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowRight } from 'lucide-react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useOverdueReceivablesTile } from './hooks/use-overdue-receivables-tile.js';

function formatGBP(minorAmount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorAmount / 100);
}

interface OverdueReceivablesTileProps {
  /** `PAY_LATE_INTEREST_ENABLED` feature flag value. */
  featureEnabled: boolean;
}

export function OverdueReceivablesTile({ featureEnabled }: OverdueReceivablesTileProps) {
  const t = useTranslations('Payments.dashboard');
  const { isLoading, data } = useOverdueReceivablesTile(featureEnabled);

  if (!featureEnabled) return null;

  if (isLoading) {
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

  if (!data || data.items.length === 0) return null;

  const totalPrincipalMinor = data.items.reduce(
    (sum, item) => sum + item.principalOutstandingMinor,
    0,
  );
  const totalInterestMinor = data.items.reduce((sum, item) => sum + item.accruedInterestMinor, 0);

  if (totalPrincipalMinor === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('overdueTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-display tabular-nums">
          {formatGBP(totalPrincipalMinor + totalInterestMinor)}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('overdueSubline', {
            principal: formatGBP(totalPrincipalMinor),
            interest: formatGBP(totalInterestMinor),
          })}
        </p>
        <Link
          href="/invoices?filter=overdue"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline pt-1">
          {t('overdueClickThrough')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
