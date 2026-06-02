/**
 * Approval-queue widget — top 5 pending approvals with SLA colour-coding.
 *
 * Ported from `apps/web/src/components/dashboard/approval-queue-widget.tsx`
 * (removed in commit 62a97d73) and rewired for the Vite SPA:
 *   - `next-intl` → `../../i18n/useTranslations.js`
 *   - direct tRPC call → `./hooks/use-approval-queue-widget.ts`
 *   - `@/i18n/navigation` → `../../i18n/navigation.js`
 */

import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Link } from '../../i18n/navigation.js';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useApprovalQueueWidget } from './hooks/use-approval-queue-widget.js';

const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(minor: number, currency: string): string {
  if (currency !== 'PLN') {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: minorUnitDigits(currency),
    }).format(minorToMajor(minor, currency));
  }
  return currencyFormatter.format(minorToMajor(minor, 'PLN'));
}

function getSlaVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'green':
      return 'success';
    case 'yellow':
      return 'warning';
    case 'red':
    case 'overdue':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getSlaAccent(status: string): string {
  switch (status) {
    case 'green':
      return 'border-s-success';
    case 'yellow':
      return 'border-s-warning';
    case 'red':
    case 'overdue':
      return 'border-s-destructive';
    default:
      return 'border-s-muted-foreground/30';
  }
}

const SLA_LABEL_KEYS: Record<string, string> = {
  green: 'approvals.slaOnTrack',
  yellow: 'approvals.slaApproaching',
  red: 'approvals.slaBreached',
  overdue: 'approvals.slaBreached',
};

export function ApprovalQueueWidget() {
  const t = useTranslations('Dashboard');
  const { isLoading, items } = useApprovalQueueWidget();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">{t('approvals.title')}</CardTitle>
        <CardAction>
          <Link href="/approvals" className="text-sm text-primary hover:underline">
            {t('approvals.seeAll')}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('approvals.empty')}</p>
        ) : (
          <ScrollArea className="max-h-[280px]">
            <div className="flex flex-col gap-2">
              {items.map(item => {
                const invoice = item.invoice;
                const contractorName =
                  invoice?.contractor?.legalName ?? invoice?.sellerName ?? '---';
                const amount = invoice?.totalMinor ?? 0;
                const currency = invoice?.currency ?? 'PLN';
                const invoiceId = item.approvalFlow?.resourceId;
                const slaStatus = item.slaStatus?.status ?? '';
                const accent = getSlaAccent(slaStatus);

                return (
                  <Link
                    key={item.id}
                    href={invoiceId ? `/invoices/${invoiceId}` : '/approvals'}
                    className={`grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-3 rounded-lg border-s-2 ${accent} ps-3 pe-2.5 py-2.5 transition-all duration-200 hover:bg-muted/40 hover:ps-3.5`}>
                    <span className="min-w-0 truncate text-sm font-medium">{contractorName}</span>
                    <span className="text-right font-display text-sm font-semibold tabular-nums text-foreground">
                      {formatAmount(amount, currency)}
                    </span>
                    <div className="flex justify-end">
                      {item.slaStatus && (
                        <Badge variant={getSlaVariant(slaStatus)}>
                          {tKey(t, SLA_LABEL_KEYS[slaStatus] ?? slaStatus)}
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
