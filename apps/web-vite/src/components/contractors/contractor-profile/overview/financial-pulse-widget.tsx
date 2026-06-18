import { Sparkline } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useTranslation } from 'react-i18next';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { formatMoneyAmount } from '../../../../lib/money.js';
import { useContractorFinancialPulse } from '../../hooks/use-contractor-financial-pulse.js';

export interface FinancialPulseWidgetProps {
  contractorId: string;
  currency: string;
}

/**
 * Detail overview financial pulse — outstanding / ready-to-pay / 12-month paid
 * totals plus a paid-invoice trend sparkline. Independent query (own skeleton +
 * retry) so it never blocks the rest of the overview. Money values use
 * foreground (not muted) text for AAA contrast.
 */
export function FinancialPulseWidget({ contractorId, currency }: FinancialPulseWidgetProps) {
  const t = useTranslations('ContractorProfile.overview');
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const { data, isLoading, isError, onRetry } = useContractorFinancialPulse(contractorId);

  const money = (minor: number) => formatMoneyAmount(minor, data?.currency ?? currency, locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('widgets.financial.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{t('widgets.financial.error')}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t('widgets.financial.retry')}
            </Button>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Stat
                label={t('widgets.financial.outstanding')}
                value={money(data.outstandingMinor)}
              />
              <Stat label={t('widgets.financial.readyToPay')} value={money(data.readyToPayMinor)} />
              <Stat label={t('widgets.financial.paid12m')} value={money(data.paidLast12mMinor)} />
              {data.avgDaysToPay == null ? null : (
                <Stat
                  label={t('widgets.financial.avgDaysToPay')}
                  value={t('widgets.financial.days', { days: data.avgDaysToPay })}
                />
              )}
            </dl>
            {data.invoiceTrendMinor.length > 1 ? (
              <Sparkline
                data={data.invoiceTrendMinor}
                srLabel={t('widgets.financial.trendSr')}
                w={220}
                h={36}
                color="var(--color-primary)"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('widgets.financial.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
