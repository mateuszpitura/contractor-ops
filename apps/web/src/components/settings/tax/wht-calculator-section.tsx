'use client';

import type { WhtServiceType } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
import { formatMinorUnits } from '@/lib/format-currency';
import { trpc } from '@/trpc/init';
import { tDyn } from '@/i18n/typed-keys';

/**
 * Cross-border withholding tax calculator.
 *
 * Wires:
 *  - tax.calculateWht (query)
 *
 * The procedure is a query, not a mutation. We disable autorun and trigger via
 * refetch() so the user clicks an explicit "Calculate" button.
 */

// Mirrors `whtServiceTypeEnum` in `@contractor-ops/validators`. Kept inline
// for the picker so we don't need to re-derive labels at runtime.
const SERVICE_TYPES: readonly WhtServiceType[] = [
  'technical_services',
  'management_fees',
  'royalties',
  'rent_equipment',
] as const;

// Countries a contractor might be resident in for cross-border WHT. The set is
// intentionally broad — server-side rules decide whether a treaty exists.
const CONTRACTOR_COUNTRIES = ['PL', 'DE', 'GB', 'FR', 'AE', 'EG', 'IN', 'US'] as const;
type ContractorCountry = (typeof CONTRACTOR_COUNTRIES)[number];

export function WhtCalculatorSection() {
  const t = useTranslations('TaxAdmin.calculator');
  const locale = useLocale();

  const [contractorResidency, setContractorResidency] = useState<ContractorCountry>('AE');
  const [serviceType, setServiceType] = useState<WhtServiceType>('technical_services');
  const [grossAmountInput, setGrossAmountInput] = useState('1000.00');

  const grossAmountMinor = useMemo(() => {
    const parsed = Number.parseFloat(grossAmountInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [grossAmountInput]);

  const isValidInput = grossAmountMinor !== null;

  const calculationQuery = useQuery({
    ...trpc.tax.calculateWht.queryOptions(
      // grossAmountMinor is guaranteed non-null when enabled is true; coerce
      // for the disabled path to satisfy the input shape.
      {
        contractorResidency,
        serviceType,
        grossAmountMinor: grossAmountMinor ?? 0,
      },
    ),
    enabled: false,
    retry: false,
  });

  async function handleCalculate() {
    if (!isValidInput) return;
    try {
      await calculationQuery.refetch({ throwOnError: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.failed'));
    }
  }

  const result = calculationQuery.data;
  const hasResult = calculationQuery.isFetched && !calculationQuery.isFetching;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wht-gross" className="text-[13px]">
              {t('grossAmountLabel')}
            </Label>
            <Input
              id="wht-gross"
              type="text"
              inputMode="decimal"
              value={grossAmountInput}
              onChange={e => setGrossAmountInput(e.target.value)}
              placeholder="1000.00"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('grossAmountHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wht-country" className="text-[13px]">
              {t('residencyLabel')}
            </Label>
            <Select
              value={contractorResidency}
              onValueChange={value => setContractorResidency(value as ContractorCountry)}>
              <SelectTrigger id="wht-country" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACTOR_COUNTRIES.map(code => (
                  <SelectItem key={code} value={code}>
                    {tDyn(t, 'country', code)} ({code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wht-service" className="text-[13px]">
              {t('serviceTypeLabel')}
            </Label>
            <Select
              value={serviceType}
              onValueChange={value => setServiceType(value as WhtServiceType)}>
              <SelectTrigger id="wht-service" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {tDyn(t, 'serviceType', type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Button onClick={handleCalculate} disabled={!isValidInput || calculationQuery.isFetching}>
            {calculationQuery.isFetching ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" />
            ) : (
              <Calculator className="me-1.5 size-3.5" />
            )}
            {t('calculateCta')}
          </Button>
        </div>

        {hasResult && result === null && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t('result.noWht')}
          </div>
        )}

        {hasResult && result && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-sm font-medium">{t('result.title')}</p>
              <Badge variant={result.treatyApplied ? 'default' : 'secondary'}>
                {result.treatyApplied ? t('result.treaty') : t('result.standard')}
              </Badge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('result.gross')}
                </dt>
                <dd className="tabular-nums font-medium">
                  {formatMinorUnits(result.grossAmountMinor, undefined, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('result.rate')}
                </dt>
                <dd className="tabular-nums font-medium">{result.whtRate.toFixed(2)}%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('result.withheld')}
                </dt>
                <dd className="tabular-nums font-medium">
                  {formatMinorUnits(result.whtAmountMinor, undefined, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('result.net')}
                </dt>
                <dd className="tabular-nums font-medium">
                  {formatMinorUnits(result.netAmountMinor, undefined, locale)}
                </dd>
              </div>
            </dl>
            {result.treatyReference && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('result.treatyReference', { reference: result.treatyReference })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
