import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { differenceInDays, isPast } from 'date-fns';
import type { MouseEvent } from 'react';
import { Link } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { formatDate } from '../../lib/format-date.js';
import { formatAmount } from '../../lib/money.js';
import { EntityDetailItem, EntitySummarySheet } from '../table-kit/entity-summary-sheet.js';
import type { ContractRow } from './contract-table/columns.js';

function stopPropagation(e: MouseEvent) {
  e.stopPropagation();
}

// ---------------------------------------------------------------------------
// Status badge colors (same as columns.tsx)
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  PENDING_SIGNATURE: 'bg-muted text-muted-foreground border border-border',
  ACTIVE: 'bg-green-500/10 text-green-800 dark:text-green-400',
  EXPIRING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cohesive summary panel render with multiple conditional field sections closing over component scope
export function ContractSidePanel({ contract, open, onOpenChange }: ContractSidePanelProps) {
  const t = useTranslations('Contracts');
  const ts = useTranslations('Contracts.sidePanel');

  if (!contract) return null;

  const rateDisplay =
    typeof contract.rateValueMinor === 'number'
      ? formatAmount(contract.rateValueMinor, contract.currency, 'pl-PL')
      : null;

  const endDate = contract.endDate ? new Date(contract.endDate) : null;
  const daysRemaining = endDate ? differenceInDays(endDate, new Date()) : null;
  const isExpired = endDate ? isPast(endDate) : false;

  return (
    <EntitySummarySheet
      open={open}
      onOpenChange={onOpenChange}
      title={contract.title}
      badges={
        <>
          <Badge variant="secondary" className={statusBadgeColors[contract.status] ?? ''}>
            {tDynLoose(t, 'status', enumKey(contract.status))}
          </Badge>
          <Link
            href={`/contractors/${contract.contractor.id}`}
            className="text-sm text-primary hover:underline"
            onClick={stopPropagation}>
            {contract.contractor.displayName ?? contract.contractor.legalName}
          </Link>
        </>
      }
      detailsTitle={ts('details')}
      footer={
        <Button render={<Link href={`/contracts/${contract.id}`} />} className="w-full">
          {ts('openContract')}
        </Button>
      }>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <EntityDetailItem
          label={t('columns.type')}
          value={tDynLoose(t, 'type', enumKey(contract.type))}
        />
        <EntityDetailItem
          label={t('columns.startDate')}
          value={contract.startDate ? formatDate(contract.startDate) : null}
        />
        <EntityDetailItem
          label={t('columns.endDate')}
          value={contract.endDate ? formatDate(contract.endDate) : null}
        />
        <EntityDetailItem label={t('columns.rate')} value={rateDisplay} mono />
        <EntityDetailItem label={t('columns.currency')} value={contract.currency} />
        <EntityDetailItem
          label={t('columns.billingCycle')}
          value={tDynLoose(t, 'billingModel', enumKey(contract.billingModel))}
        />
        <EntityDetailItem label={t('columns.owner')} value={contract.internalOwner?.name} />
      </div>
      {endDate && daysRemaining !== null ? (
        <>
          <Separator className="my-4" />
          <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
            {ts('keyDates')}
          </h3>
          <p className="text-sm mt-3">
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
        </>
      ) : null}
    </EntitySummarySheet>
  );
}
