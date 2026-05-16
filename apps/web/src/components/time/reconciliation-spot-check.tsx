'use client';

import { useQuery } from '@tanstack/react-query';
import { Calculator, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/trpc/init';

/**
 * Reconciliation spot-check — single contract / single period drill-down.
 *
 * Wires:
 *  - time.listContractors (query)   → contractor picker (only contractors
 *    with at least one timesheet are returned).
 *  - time.getReconciliation (query) → on-demand reconciliation computation.
 *    Disabled by default; fires on explicit button click via refetch().
 *
 * Complements the bulk `ReconciliationTable` (which scans all invoices) by
 * letting a manager probe a specific contract + period + invoiced amount
 * without needing a matching invoice in the system.
 */

interface ContractorOption {
  id: string;
  legalName: string;
  email: string | null;
  pendingCount: number;
  approvedMinutesThisMonth: number;
}

interface ContractOption {
  id: string;
  title?: string | null;
  rateType?: string | null;
  rateValueMinor?: number | null;
  currency?: string | null;
  contractor?: { id: string; legalName: string; displayName?: string | null } | null;
}

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

export function ReconciliationSpotCheck() {
  const t = useTranslations('Time.spotCheck');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [contractorId, setContractorId] = useState<string>('');
  const [contractId, setContractId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>(monthAgo);
  const [periodEnd, setPeriodEnd] = useState<string>(today);
  const [invoicedInput, setInvoicedInput] = useState<string>('0.00');

  // ---------------------------------------------------------------------
  // Contractor picker
  // ---------------------------------------------------------------------
  const contractorsQuery = useQuery(trpc.time.listContractors.queryOptions());
  const contractors = (contractorsQuery.data ?? []) as ContractorOption[];

  // ---------------------------------------------------------------------
  // Contract picker (filtered by contractor)
  // ---------------------------------------------------------------------
  const contractsQuery = useQuery({
    ...trpc.contract.list.queryOptions({
      page: 1,
      pageSize: 50,
      contractorId: contractorId || undefined,
      sortBy: 'startDate',
      sortOrder: 'desc',
    }),
    enabled: Boolean(contractorId),
  });

  const contractList = useMemo(() => {
    const data = contractsQuery.data as { items: ContractOption[] } | undefined;
    return data?.items ?? [];
  }, [contractsQuery.data]);

  // ---------------------------------------------------------------------
  // Parse invoiced amount → minor units
  // ---------------------------------------------------------------------
  const invoicedAmountMinor = useMemo(() => {
    const parsed = Number.parseFloat(invoicedInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [invoicedInput]);

  const validPeriod =
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    new Date(periodStart).getTime() <= new Date(periodEnd).getTime();

  const canRun = Boolean(contractId) && validPeriod && invoicedAmountMinor !== null;

  // ---------------------------------------------------------------------
  // Reconciliation query — on-demand
  // ---------------------------------------------------------------------
  const reconciliationQuery = useQuery({
    ...trpc.time.getReconciliation.queryOptions({
      contractId: contractId || 'placeholder',
      periodStart: periodStart || today,
      periodEnd: periodEnd || today,
      invoicedAmountMinor: invoicedAmountMinor ?? 0,
    }),
    enabled: false,
    retry: false,
  });

  async function handleRun() {
    if (!canRun) return;
    try {
      await reconciliationQuery.refetch({ throwOnError: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.failed'));
    }
  }

  const result = reconciliationQuery.data;
  const hasResult = reconciliationQuery.isFetched && !reconciliationQuery.isFetching;

  // Reset selected contract when contractor changes
  function handleContractorChange(value: string | null) {
    setContractorId(value ?? '');
    setContractId('');
  }

  function handleContractChange(value: string | null) {
    setContractId(value ?? '');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Pickers row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="spotcheck-contractor">{t('contractorLabel')}</Label>
            <Select
              value={contractorId}
              onValueChange={handleContractorChange}
              disabled={contractorsQuery.isLoading}>
              <SelectTrigger id="spotcheck-contractor">
                <SelectValue
                  placeholder={
                    contractorsQuery.isLoading
                      ? t('loadingContractors')
                      : t('contractorPlaceholder')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {contractors.length === 0 && !contractorsQuery.isLoading ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t('noContractors')}
                  </div>
                ) : (
                  contractors.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.legalName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spotcheck-contract">{t('contractLabel')}</Label>
            <Select
              value={contractId}
              onValueChange={handleContractChange}
              disabled={!contractorId || contractsQuery.isLoading}>
              <SelectTrigger id="spotcheck-contract">
                <SelectValue
                  placeholder={
                    contractorId
                      ? contractsQuery.isLoading
                        ? t('loadingContracts')
                        : t('contractPlaceholder')
                      : t('selectContractorFirst')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {contractList.length === 0 && !contractsQuery.isLoading ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t('noContracts')}
                  </div>
                ) : (
                  contractList.map(contract => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.title ?? contract.id.slice(0, 8)}
                      {contract.rateType ? ` · ${contract.rateType}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spotcheck-invoiced">{t('invoicedAmountLabel')}</Label>
            <Input
              id="spotcheck-invoiced"
              type="text"
              inputMode="decimal"
              value={invoicedInput}
              onChange={e => setInvoicedInput(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('invoicedAmountHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spotcheck-from">{t('periodStartLabel')}</Label>
            <Input
              id="spotcheck-from"
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              max={periodEnd || undefined}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spotcheck-to">{t('periodEndLabel')}</Label>
            <Input
              id="spotcheck-to"
              type="date"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              min={periodStart || undefined}
            />
          </div>
        </div>

        {/* CTA */}
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

        {/* Empty / pre-run state */}
        {!(hasResult || contractId) && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t('emptyState')}
          </div>
        )}

        {/* No-data result (null = non time-based contract or zero approved minutes) */}
        {hasResult && result === null && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t('noResult')}
          </div>
        )}

        {/* Result panel */}
        {hasResult && result && (
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
                <dd className="tabular-nums font-medium">
                  {formatMinor(result.expectedAmountMinor)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('invoicedAmount')}
                </dt>
                <dd className="tabular-nums font-medium">
                  {formatMinor(result.invoicedAmountMinor)}
                </dd>
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
        )}

        {/* Error state */}
        {reconciliationQuery.isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {reconciliationQuery.error instanceof Error
              ? reconciliationQuery.error.message
              : t('toast.failed')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
