/**
 * Reconciliation spot-check (single contract/period drill-down).
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Calculator, Loader2 } from 'lucide-react';
import { useCallback, useId } from 'react';

import { useReconciliationSpotCheck } from './hooks/use-reconciliation-spot-check.js';

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatMinor(minor: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// Empty-or-options body shared by the contractor/contract selects: an empty
// hint while there are no rows (and not loading), otherwise the mapped items.
function SelectOptions<T>({
  items,
  isLoading,
  emptyLabel,
  renderItem,
}: {
  items: T[];
  isLoading: boolean;
  emptyLabel: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (items.length === 0 && !isLoading) {
    return <div className="px-2 py-1.5 text-xs text-muted-foreground">{emptyLabel}</div>;
  }
  return <>{items.map(renderItem)}</>;
}

type ReconciliationSpotCheck = ReturnType<typeof useReconciliationSpotCheck>;

function ReconciliationResultPanel({
  result,
  t,
}: {
  result: NonNullable<ReconciliationSpotCheck['result']>;
  t: ReconciliationSpotCheck['t'];
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-sm font-medium">{t('resultTitle')}</p>
        <Badge variant={result.withinThreshold ? 'default' : 'destructive'}>
          {result.withinThreshold ? t('withinThreshold') : t('exceedsThreshold')}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {t('thresholdSuffix', { percent: result.thresholdPercent })}
        </span>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('approvedHours')}
          </dt>
          <dd className="tabular-nums font-medium">{formatHours(result.approvedMinutes)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('expectedAmount')}
          </dt>
          <dd className="tabular-nums font-medium">{formatMinor(result.expectedAmountMinor)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('invoicedAmount')}
          </dt>
          <dd className="tabular-nums font-medium">{formatMinor(result.invoicedAmountMinor)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('deviation')}
          </dt>
          <dd
            className={`tabular-nums font-medium ${
              result.withinThreshold ? 'text-foreground' : 'text-destructive'
            }`}>
            {result.deviationMinor >= 0 ? '+' : ''}
            {formatMinor(result.deviationMinor)}{' '}
            <span className="text-xs text-muted-foreground">
              ({result.deviationPercent.toFixed(2)}%)
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        {t('rateFootnote', {
          rateType: result.rateType,
          rate: formatMinor(result.rateValueMinor),
        })}
      </p>
    </div>
  );
}

export function ReconciliationSpotCheckView({
  t,
  contractorId,
  contractId,
  periodStart,
  periodEnd,
  invoicedInput,
  setPeriodStart,
  setPeriodEnd,
  setInvoicedInput,
  contractorsQuery,
  contractors,
  contractsQuery,
  contractList,
  canRun,
  reconciliationQuery,
  handleRun,
  result,
  hasResult,
  runCompleted,
  handleContractorChange,
  handleContractChange,
}: ReturnType<typeof useReconciliationSpotCheck>) {
  const contractorSelectId = useId();
  const contractSelectId = useId();
  const invoicedId = useId();
  const fromId = useId();
  const toId = useId();
  const handleInvoicedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setInvoicedInput(e.target.value),
    [setInvoicedInput],
  );
  const handlePeriodStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPeriodStart(e.target.value),
    [setPeriodStart],
  );
  const handlePeriodEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPeriodEnd(e.target.value),
    [setPeriodEnd],
  );
  const renderContractorOption = useCallback(
    (c: (typeof contractors)[number]) => (
      <SelectItem key={c.id} value={c.id}>
        {c.legalName}
      </SelectItem>
    ),
    [],
  );
  const renderContractOption = useCallback(
    (contract: (typeof contractList)[number]) => (
      <SelectItem key={contract.id} value={contract.id}>
        {contract.title ?? contract.id.slice(0, 8)}
        {contract.rateType ? ` · ${contract.rateType}` : ''}
      </SelectItem>
    ),
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {runCompleted ? null : <p className="text-sm text-muted-foreground">{t('emptyState')}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={contractorSelectId}>{t('contractorLabel')}</Label>
            <Select value={contractorId} onValueChange={handleContractorChange}>
              <SelectTrigger id={contractorSelectId} loading={contractorsQuery.isLoading}>
                <SelectValue placeholder={t('contractorPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectOptions
                  items={contractors}
                  isLoading={contractorsQuery.isLoading}
                  emptyLabel={t('noContractors')}
                  renderItem={renderContractorOption}
                />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={contractSelectId}>{t('contractLabel')}</Label>
            <Select
              value={contractId}
              onValueChange={handleContractChange}
              disabled={!contractorId}>
              <SelectTrigger id={contractSelectId} loading={contractsQuery.isLoading}>
                <SelectValue
                  placeholder={contractorId ? t('contractPlaceholder') : t('selectContractorFirst')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectOptions
                  items={contractList}
                  isLoading={contractsQuery.isLoading}
                  emptyLabel={t('noContracts')}
                  renderItem={renderContractOption}
                />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={invoicedId}>{t('invoicedAmountLabel')}</Label>
            <Input
              id={invoicedId}
              type="text"
              inputMode="decimal"
              value={invoicedInput}
              onChange={handleInvoicedChange}
              placeholder="0.00"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('invoicedAmountHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={fromId}>{t('periodStartLabel')}</Label>
            <Input
              id={fromId}
              type="date"
              value={periodStart}
              onChange={handlePeriodStartChange}
              max={periodEnd || undefined}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={toId}>{t('periodEndLabel')}</Label>
            <Input
              id={toId}
              type="date"
              value={periodEnd}
              onChange={handlePeriodEndChange}
              min={periodStart || undefined}
            />
          </div>
        </div>

        <div>
          <Button onClick={handleRun} disabled={!canRun || reconciliationQuery.isFetching}>
            {reconciliationQuery.isFetching ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" />
            ) : (
              <Calculator className="me-1.5 size-3.5" />
            )}
            {t('runCta')}
          </Button>
        </div>

        {hasResult && result === null && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t('noResult')}
          </div>
        )}

        {hasResult && result ? <ReconciliationResultPanel result={result} t={t} /> : null}

        {reconciliationQuery.isError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {reconciliationQuery.error instanceof Error
              ? reconciliationQuery.error.message
              : t('toast.failed')}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ReconciliationSpotCheck() {
  const spotCheck = useReconciliationSpotCheck();
  return <ReconciliationSpotCheckView {...spotCheck} />;
}
