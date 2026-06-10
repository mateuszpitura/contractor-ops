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
import type { WhtServiceType } from '@contractor-ops/validators';
import { Calculator, Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { tDyn } from '../../../i18n/typed-keys';
import { formatMinorUnits } from '../../../lib/money.js';
import type {
  ContractorCountry,
  useWhtCalculatorSection as UseWhtCalculatorSection,
} from './hooks/use-wht-calculator-section.js';
import {
  CONTRACTOR_COUNTRIES,
  SERVICE_TYPES,
  useWhtCalculatorSection,
} from './hooks/use-wht-calculator-section.js';

export type WhtCalculatorSectionProps = ReturnType<typeof UseWhtCalculatorSection>;

export function WhtCalculatorSectionView({
  t,
  locale,
  contractorResidency,
  setContractorResidency,
  serviceType,
  setServiceType,
  grossAmountInput,
  setGrossAmountInput,
  isValidInput,
  calculationQuery,
  handleCalculate,
  result,
  hasResult,
}: WhtCalculatorSectionProps) {
  const handleGrossChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setGrossAmountInput(e.target.value),
    [setGrossAmountInput],
  );
  const handleResidencyChange = useCallback(
    (value: ContractorCountry | null) => {
      if (value) setContractorResidency(value);
    },
    [setContractorResidency],
  );
  const handleServiceTypeChange = useCallback(
    (value: WhtServiceType | null) => {
      if (value) setServiceType(value);
    },
    [setServiceType],
  );

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
              onChange={handleGrossChange}
              placeholder="1000.00"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('grossAmountHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wht-country" className="text-[13px]">
              {t('residencyLabel')}
            </Label>
            <Select value={contractorResidency} onValueChange={handleResidencyChange}>
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
            <Select value={serviceType} onValueChange={handleServiceTypeChange}>
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

export function WhtCalculatorSection() {
  const section = useWhtCalculatorSection();
  return <WhtCalculatorSectionView {...section} />;
}
