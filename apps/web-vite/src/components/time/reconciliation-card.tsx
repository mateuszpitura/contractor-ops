/**
 * Time reconciliation card.
 */

import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Clock } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { formatMinorUnits as formatMinorUnitsLib } from '../../lib/money.js';
import { DeviationFlag } from './deviation-flag.js';

interface TimeReconciliation {
  approvedMinutes: number;
  rateValueMinor: number;
  rateType: string;
  hoursPerDay: number;
  expectedAmountMinor: number;
  invoicedAmountMinor: number;
  deviationMinor: number;
  deviationPercent: number;
  withinThreshold: boolean;
  thresholdPercent: number;
}

interface ReconciliationCardProps {
  reconciliation: TimeReconciliation;
}

function formatMinorUnits(minor: number): string {
  return formatMinorAsCurrency(minor, 'PLN', 'pl-PL');
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}` : hours.toFixed(1);
}

function formatRate(minor: number): string {
  return formatMinorUnitsLib(minor, null, 'pl-PL');
}

function getBorderColor(deviationPercent: number, thresholdPercent: number): string {
  if (deviationPercent <= thresholdPercent) {
    return 'border-s-green-600 dark:border-s-green-500';
  }
  if (deviationPercent <= 2 * thresholdPercent) {
    return 'border-s-amber-500 dark:border-s-amber-400';
  }
  return 'border-s-destructive';
}

export function ReconciliationCard({ reconciliation }: ReconciliationCardProps) {
  const t = useTranslations('Time');
  const {
    approvedMinutes,
    rateValueMinor,
    expectedAmountMinor,
    invoicedAmountMinor,
    deviationPercent,
    thresholdPercent,
  } = reconciliation;

  const borderColor = getBorderColor(deviationPercent, thresholdPercent);
  const hours = formatHours(approvedMinutes);
  const rate = formatRate(rateValueMinor);

  const maxAmount = Math.max(expectedAmountMinor, invoicedAmountMinor);
  const _expectedRatio = maxAmount > 0 ? (expectedAmountMinor / maxAmount) * 100 : 0;
  const _invoicedRatio = maxAmount > 0 ? (invoicedAmountMinor / maxAmount) * 100 : 0;
  const hasOverflow = invoicedAmountMinor > expectedAmountMinor;

  return (
    <Card className={`border-s-4 ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('reconciliation.title')}</span>
          </div>
          <DeviationFlag
            deviationPercent={deviationPercent}
            thresholdPercent={thresholdPercent}
            expectedAmountMinor={expectedAmountMinor}
            invoicedAmountMinor={invoicedAmountMinor}
            rateValueMinor={rateValueMinor}
            approvedMinutes={approvedMinutes}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">
              {t('reconciliation.approvedHours')}
            </span>
            <p className="text-lg font-semibold tabular-nums">{hours}h</p>
            <p className="text-xs text-muted-foreground">{t('reconciliation.atRate', { rate })}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">
              {t('reconciliation.expectedAmount')}
            </span>
            <p className="text-lg font-semibold tabular-nums">
              {formatMinorUnits(expectedAmountMinor)}
            </p>
            <p className="text-xs text-muted-foreground">{t('reconciliation.basedOnApproved')}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[13px] text-muted-foreground">
              {t('reconciliation.invoicedAmount')}
            </span>
            <p className="text-lg font-semibold tabular-nums">
              {formatMinorUnits(invoicedAmountMinor)}
            </p>
            <p className="text-xs text-muted-foreground">{t('reconciliation.fromInvoice')}</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('reconciliation.expected')}</span>
            <span>{t('reconciliation.invoiced')}</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-y-0 start-0 rounded-full bg-primary/60 transition-all duration-300 ease-out" />
            {hasOverflow && (
              <div className="absolute inset-y-0 start-0 rounded-full bg-destructive/40 transition-all duration-300 ease-out" />
            )}
            {hasOverflow && (
              <div className="absolute inset-y-0 start-0 rounded-full bg-primary/60 transition-all duration-300 ease-out" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
