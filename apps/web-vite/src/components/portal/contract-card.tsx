import type { ContractStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { Link } from '../../i18n/navigation.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { formatMoneyAmount } from '../../lib/money.js';
import { cn } from '../../lib/utils.js';

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

export function ContractCard({ contract, className }: ContractCardProps) {
  const { formatDate } = usePortalDateFormatter();

  const dateRange = [
    formatDate(contract.startDate),
    contract.endDate ? formatDate(contract.endDate) : 'Ongoing',
  ].join(' - ');

  const rate =
    contract.rateValueMinor != null && contract.rateType
      ? `${formatMoneyAmount(contract.rateValueMinor, contract.currency, 'en-US')}${ratePeriodLabel(contract.rateType)}`
      : null;

  return (
    <Link href={`/portal/contracts/${contract.id}`} className="block">
      <Card className={cn('cursor-pointer transition-colors hover:border-primary/50', className)}>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-snug">{contract.title}</p>
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
