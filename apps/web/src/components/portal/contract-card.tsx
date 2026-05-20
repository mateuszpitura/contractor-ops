'use client';

import type { ContractStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Link } from '@/i18n/navigation';
import { usePortalDateFormatter } from '@/lib/format/use-portal-date-formatter';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractCardContract {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string | null;
  currency: string;
  rateType: string | null;
  rateValueMinor: number | null;
  contractNumber: string | null;
}

interface ContractCardProps {
  contract: ContractCardContract;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format minor-unit amount to display currency (e.g. "12,000 PLN").
 */
function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * Map rate type to period abbreviation.
 */
function ratePeriodLabel(rateType: string): string {
  switch (rateType) {
    case 'MONTHLY':
      return '/mo';
    case 'HOURLY':
      return '/hr';
    case 'DAILY':
      return '/day';
    case 'FIXED':
      return ' fixed';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// ContractCard
// ---------------------------------------------------------------------------

/**
 * Clickable contract card for the contracts list page.
 *
 * Per UI-SPEC D-02 / PORT-02: card grid with title, contract number,
 * date range, rate, and status badge. Links to contract detail.
 */
export function ContractCard({ contract, className }: ContractCardProps) {
  const { formatDate } = usePortalDateFormatter();

  const dateRange = [
    formatDate(contract.startDate),
    contract.endDate ? formatDate(contract.endDate) : 'Ongoing',
  ].join(' - ');

  const rate =
    contract.rateValueMinor != null && contract.rateType
      ? `${formatAmount(contract.rateValueMinor, contract.currency)}${ratePeriodLabel(contract.rateType)}`
      : null;

  return (
    <Link href={`/portal/contracts/${contract.id}`} className="block">
      <Card className={cn('cursor-pointer transition-colors hover:border-primary/50', className)}>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug truncate">{contract.title}</p>
              {!!contract.contractNumber && (
                <p className="text-[13px] text-muted-foreground">{contract.contractNumber}</p>
              )}
            </div>
            <AtelierStatusPill
              variant={statusToVariant('contract', contract.status as ContractStatusInput)}>
              {contract.status.charAt(0) + contract.status.slice(1).toLowerCase()}
            </AtelierStatusPill>
          </div>
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <span>{dateRange}</span>
            {!!rate && <span className="font-medium text-foreground">{rate}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ContractCardSkeleton
// ---------------------------------------------------------------------------

/**
 * Loading skeleton matching ContractCard dimensions.
 */
export function ContractCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
