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
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useId } from 'react';
import { tDyn } from '../../../i18n/typed-keys';
import type {
  SupportedCountry,
  useCountryRatesSection as UseCountryRatesSection,
} from './hooks/use-country-rates-section.js';
import { SUPPORTED_COUNTRIES, useCountryRatesSection } from './hooks/use-country-rates-section.js';

export type CountryRatesSectionProps = ReturnType<typeof UseCountryRatesSection>;

export function CountryRatesSectionView({
  t,
  country,
  setCountry,
  validateCode,
  setValidateCode,
  validation,
  handleValidate,
  rates,
  isLoading,
}: CountryRatesSectionProps) {
  const countryId = useId();
  const validateCodeId = useId();

  const handleCountryChange = useCallback(
    (value: SupportedCountry | null) => {
      if (value) setCountry(value);
    },
    [setCountry],
  );
  const handleValidateCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValidateCode(e.target.value),
    [setValidateCode],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor={countryId} className="text-[13px]">
            {t('countryLabel')}
          </Label>
          <Select value={country} onValueChange={handleCountryChange}>
            <SelectTrigger id={countryId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_COUNTRIES.map(code => (
                <SelectItem key={code} value={code}>
                  {tDyn(t, 'country', code)} ({code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-lg border">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rates.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('emptyState')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.code')}</TableHead>
                  <TableHead>{t('table.description')}</TableHead>
                  <TableHead className="text-end">{t('table.rate')}</TableHead>
                  <TableHead>{t('table.flags')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map(rate => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-mono text-xs">{rate.code}</TableCell>
                    <TableCell>{rate.description}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {rate.ratePercent.toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rate.isDefault ? (
                          <Badge variant="secondary">{t('badge.default')}</Badge>
                        ) : null}
                        {rate.isReverseCharge ? (
                          <Badge variant="outline">{t('badge.reverseCharge')}</Badge>
                        ) : null}
                        {rate.isExempt ? (
                          <Badge variant="outline">{t('badge.exempt')}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('validation.title')}</p>
            <p className="text-sm text-muted-foreground">{t('validation.description')}</p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5 sm:max-w-xs">
              <Label htmlFor={validateCodeId} className="text-[13px]">
                {t('validation.codeLabel')}
              </Label>
              <Input
                id={validateCodeId}
                value={validateCode}
                onChange={handleValidateCodeChange}
                placeholder={t('validation.codePlaceholder')}
                maxLength={10}
                autoComplete="off"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={!validateCode.trim() || validation.status === 'pending'}>
              {validation.status === 'pending' && (
                <Loader2 className="me-1.5 size-3.5 animate-spin" />
              )}
              {t('validation.checkCta')}
            </Button>
          </div>

          {validation.status === 'valid' && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              {t('validation.valid')}
            </p>
          )}
          {validation.status === 'invalid' && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {t('validation.invalid')}
            </p>
          )}
          {validation.status === 'error' && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {validation.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CountryRatesSection() {
  const section = useCountryRatesSection();
  return <CountryRatesSectionView {...section} />;
}
