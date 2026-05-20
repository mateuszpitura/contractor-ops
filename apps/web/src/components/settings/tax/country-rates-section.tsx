'use client';

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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { tDyn } from '@/i18n/typed-keys';
import { trpc } from '@/trpc/init';

/**
 * Country VAT/tax rates browser plus inline validation of a single rate code
 * against the org's statutory country.
 *
 * Wires:
 *  - tax.getRatesByCountry (query)
 *  - tax.validateRate      (query)
 */

// Countries we currently maintain rate tables for. Kept narrow on purpose —
// extending this is a data + compliance exercise, not a UI tweak.
const SUPPORTED_COUNTRIES = ['PL', 'DE', 'GB', 'SA', 'AE', 'EG'] as const;
type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

const DEFAULT_COUNTRY: SupportedCountry = 'PL';

type ValidationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'error'; message: string };

export function CountryRatesSection() {
  const t = useTranslations('TaxAdmin.rates');
  const queryClient = useQueryClient();

  const [country, setCountry] = useState<SupportedCountry>(DEFAULT_COUNTRY);
  const [validateCode, setValidateCode] = useState('');
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' });

  const ratesQuery = useQuery(trpc.tax.getRatesByCountry.queryOptions({ countryCode: country }));

  async function handleValidate() {
    const code = validateCode.trim().toUpperCase();
    if (!code) {
      setValidation({ status: 'idle' });
      return;
    }
    setValidation({ status: 'pending' });
    try {
      const result = await queryClient.fetchQuery(trpc.tax.validateRate.queryOptions({ code }));
      setValidation({ status: result.valid ? 'valid' : 'invalid' });
    } catch (err) {
      setValidation({
        status: 'error',
        message: err instanceof Error ? err.message : t('validation.unknownError'),
      });
    }
  }

  const isLoading = ratesQuery.isLoading;
  const rates = ratesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="tax-country" className="text-[13px]">
            {t('countryLabel')}
          </Label>
          <Select value={country} onValueChange={value => setCountry(value as SupportedCountry)}>
            <SelectTrigger id="tax-country" className="w-full">
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
                        {rate.isDefault && <Badge variant="secondary">{t('badge.default')}</Badge>}
                        {rate.isReverseCharge && (
                          <Badge variant="outline">{t('badge.reverseCharge')}</Badge>
                        )}
                        {rate.isExempt && <Badge variant="outline">{t('badge.exempt')}</Badge>}
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
              <Label htmlFor="tax-validate-code" className="text-[13px]">
                {t('validation.codeLabel')}
              </Label>
              <Input
                id="tax-validate-code"
                value={validateCode}
                onChange={e => setValidateCode(e.target.value)}
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
