'use client';

import { differenceInDays, isPast } from 'date-fns';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Link } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import type { ContractRow } from './contract-table/columns';
import { tDyn } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Status badge colors (same as columns.tsx)
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  PENDING_SIGNATURE: 'bg-muted text-muted-foreground border border-border',
  ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400',
  EXPIRING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  EXPIRED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  TERMINATED: 'bg-muted text-muted-foreground border border-border',
  SUPERSEDED: 'bg-muted/50 text-muted-foreground/60 border border-border/50',
  ARCHIVED: 'bg-muted text-muted-foreground border border-border',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContractSidePanelProps {
  contract: ContractRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-out side panel showing contract summary.
 * Opens from right on row click. 480px on desktop, 400px on tablet.
 */
export function ContractSidePanel({ contract, open, onOpenChange }: ContractSidePanelProps) {
  const t = useTranslations('Contracts');
  const ts = useTranslations('Contracts.sidePanel');
  const { formatDate } = useDateFormatter();

  if (!contract) return null;

  const rateDisplay =
    typeof contract.rateValueMinor === 'number'
      ? new Intl.NumberFormat('pl-PL', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(contract.rateValueMinor / 100)
      : null;

  // Key dates calculation
  const endDate = contract.endDate ? new Date(contract.endDate) : null;
  const daysRemaining = endDate ? differenceInDays(endDate, new Date()) : null;
  const isExpired = endDate ? isPast(endDate) : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Header */}
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
                {contract.title}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={statusBadgeColors[contract.status] ?? ''}>
                  {tDyn(t, 'status', enumKey(contract.status))}
                </Badge>
                <Link
                  href={`/contractors/${contract.contractor.id}`}
                  className="text-sm text-primary hover:underline"
                  // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
                  onClick={e => e.stopPropagation()}>
                  {contract.contractor.displayName ?? contract.contractor.legalName}
                </Link>
              </div>
            </SheetHeader>

            <Separator />

            {/* Details card */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {ts('details')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem
                  label={t('columns.type')}
                  value={tDyn(t, 'type', enumKey(contract.type))}
                />
                <DetailItem
                  label={t('columns.startDate')}
                  value={contract.startDate ? formatDate(contract.startDate) : null}
                />
                <DetailItem
                  label={t('columns.endDate')}
                  value={contract.endDate ? formatDate(contract.endDate) : null}
                />
                <DetailItem
                  label={t('columns.rate')}
                  value={rateDisplay ? `${rateDisplay} ${contract.currency}` : null}
                  mono
                />
                <DetailItem label={t('columns.currency')} value={contract.currency} />
                <DetailItem
                  label={t('columns.billingCycle')}
                  value={tDyn(t, 'billingModel', enumKey(contract.billingModel),
                  )}
                />
                <DetailItem label={t('columns.owner')} value={contract.internalOwner?.name} />
              </div>
            </div>

            <Separator />

            {/* Key dates */}
            {endDate && daysRemaining !== null && (
              <>
                <div className="space-y-3">
                  <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                    {ts('keyDates')}
                  </h3>
                  <p className="text-sm">
                    {isExpired ? (
                      <span className="text-destructive">
                        {ts('expired', { count: Math.abs(daysRemaining) })}
                      </span>
                    ) : daysRemaining <= 30 ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {ts('expiringSoon', { count: daysRemaining })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {ts('daysRemaining', { count: daysRemaining })}
                      </span>
                    )}
                  </p>
                </div>

                <Separator />
              </>
            )}

            {/* Open full contract CTA */}
            <Button render={<Link href={`/contracts/${contract.id}`} />} className="w-full">
              {ts('openContract')}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Detail item
// ---------------------------------------------------------------------------

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-[13px]' : ''}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </dd>
    </div>
  );
}
