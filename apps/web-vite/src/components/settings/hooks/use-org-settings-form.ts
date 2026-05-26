import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useLocale } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { DateFormatKey, TimeFormatKey } from '../../../lib/format-date';
import {
  DATE_FORMATS,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
  TIME_FORMATS,
} from '../../../lib/format-date';
import { useTRPC } from '../../../providers/trpc-provider.js';

const updateSettingsSchema = z.object({
  name: z.string().min(2).max(255),
  legalName: z.string().max(255).optional(),
  country: z.string().length(2),
  currency: z.string().length(3),
  timezone: z.string().min(1),
  language: z.enum(['pl', 'en', 'ar', 'de']),
  dateFormat: z.enum(DATE_FORMATS),
  timeFormat: z.enum(TIME_FORMATS),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  billingEmail: z.email().optional().or(z.literal('')),
});

export type SettingsValues = z.infer<typeof updateSettingsSchema>;

function getAllTimezones(): Array<{ value: string; label: string }> {
  try {
    const zones = Intl.supportedValuesOf('timeZone');
    return zones.map(tz => {
      try {
        const offset =
          new Intl.DateTimeFormat('en', {
            timeZone: tz,
            timeZoneName: 'shortOffset',
          })
            .formatToParts(new Date())
            .find(p => p.type === 'timeZoneName')?.value ?? '';
        return { value: tz, label: `${tz.replace(/_/g, ' ')} (${offset})` };
      } catch {
        return { value: tz, label: tz.replace(/_/g, ' ') };
      }
    });
  } catch {
    return [
      { value: 'Europe/Warsaw', label: 'Europe/Warsaw (GMT+1)' },
      { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1)' },
      { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
      { value: 'America/New_York', label: 'America/New York (GMT-5)' },
      { value: 'UTC', label: 'UTC' },
    ];
  }
}

function getAllCurrencies(): Array<{ value: string; label: string }> {
  const common = [
    'PLN',
    'EUR',
    'USD',
    'GBP',
    'CHF',
    'CZK',
    'SEK',
    'NOK',
    'DKK',
    'HUF',
    'RON',
    'BGN',
    'HRK',
    'UAH',
    'JPY',
    'CNY',
    'AUD',
    'CAD',
    'BRL',
    'INR',
  ];
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
    return common.map(code => ({
      value: code,
      label: `${code} — ${displayNames.of(code) ?? code}`,
    }));
  } catch {
    return common.map(code => ({ value: code, label: code }));
  }
}

function getAllCountries(): Array<{ value: string; label: string }> {
  const codes = [
    'PL',
    'DE',
    'GB',
    'US',
    'FR',
    'IT',
    'ES',
    'NL',
    'BE',
    'AT',
    'CH',
    'CZ',
    'SK',
    'HU',
    'RO',
    'BG',
    'HR',
    'SI',
    'LT',
    'LV',
    'EE',
    'SE',
    'NO',
    'DK',
    'FI',
    'IE',
    'PT',
    'GR',
    'UA',
    'CA',
    'AU',
    'JP',
    'CN',
    'IN',
    'BR',
    'MX',
    'KR',
    'SG',
    'HK',
    'NZ',
    'IL',
    'AE',
    'SA',
    'ZA',
    'TR',
    'AR',
    'CL',
    'CO',
    'PE',
  ];
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return codes
      .map(code => ({
        value: code,
        label: displayNames.of(code) ?? code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return codes
      .map(code => ({ value: code, label: code }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}

function getMonths(locale: string): Array<{ value: number; label: string }> {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: formatter.format(new Date(2024, i, 1)),
  }));
}

export function useOrgSettingsForm() {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('Settings');
  const tToast = useTranslations('Settings.toast');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const timezones = useMemo(() => getAllTimezones(), []);
  const currencies = useMemo(() => getAllCurrencies(), []);
  const countries = useMemo(() => getAllCountries(), []);
  const months = useMemo(() => getMonths(locale), [locale]);

  const settingsQuery = useQuery(trpc.settings.get.queryOptions());

  const updateMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        queryClient.invalidateQueries({ queryKey: trpc.settings.get.queryKey() });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('saveSettingsFailed'));
      },
    }),
  );

  const form = useForm<SettingsValues>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      name: '',
      legalName: '',
      country: 'PL',
      currency: 'PLN',
      timezone: 'Europe/Warsaw',
      language: 'pl',
      dateFormat: DEFAULT_DATE_FORMAT,
      timeFormat: DEFAULT_TIME_FORMAT,
      fiscalYearStartMonth: 1,
      billingEmail: '',
    },
  });

  const { register, handleSubmit, setValue, watch, reset, formState } = form;

  useEffect(() => {
    if (settingsQuery.data) {
      const data = settingsQuery.data;
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      reset({
        name: data.name ?? '',
        legalName: (metadata.legalName as string) ?? '',
        country: (metadata.countryCode as string) ?? 'PL',
        currency: (metadata.defaultCurrency as string) ?? 'PLN',
        timezone: (metadata.timezone as string) ?? 'Europe/Warsaw',
        language: ((metadata.language as string) ?? 'pl') as 'pl' | 'en' | 'ar' | 'de',
        dateFormat: ((metadata.dateFormat as string) ?? DEFAULT_DATE_FORMAT) as DateFormatKey,
        timeFormat: ((metadata.timeFormat as string) ?? DEFAULT_TIME_FORMAT) as TimeFormatKey,
        fiscalYearStartMonth: (metadata.fiscalYearStartMonth as number) ?? 1,
        billingEmail: (metadata.billingEmail as string) ?? '',
      });
    }
  }, [settingsQuery.data, reset]);

  const onSubmit = (values: SettingsValues) => {
    updateMutation.mutate({
      name: values.name,
      legalName: values.legalName || undefined,
      fiscalYearStartMonth: values.fiscalYearStartMonth,
      billingEmail: values.billingEmail || undefined,
      language: values.language,
      dateFormat: values.dateFormat,
      timeFormat: values.timeFormat,
    });
  };

  return {
    id,
    t,
    timezones,
    currencies,
    countries,
    months,
    isLoading: settingsQuery.isLoading,
    register,
    handleSubmit,
    setValue,
    watch,
    onSubmit,
    errors: formState.errors,
    isDirty: formState.isDirty,
    isPending: updateMutation.isPending,
  } as const;
}
