import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardFooter,
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
import { Loader2, Save } from 'lucide-react';
import { useCallback } from 'react';
import { tDyn } from '../../i18n/typed-keys';
import type { DateFormatKey, TimeFormatKey } from '../../lib/format-date';
import {
  DATE_FORMATS,
  previewDateFormat,
  previewTimeFormat,
  TIME_FORMATS,
} from '../../lib/format-date';
import { KleinunternehmerToggle } from '../organization/kleinunternehmer-toggle.js';
import { useOrgKleinunternehmer } from './hooks/use-org-kleinunternehmer.js';
import { useOrgSettingsForm } from './hooks/use-org-settings-form.js';

export type OrgSettingsFormProps = ReturnType<typeof useOrgSettingsForm>;

const SKELETON_FIELD_KEYS = ['name', 'timezone', 'currency', 'country', 'vat', 'locale'] as const;

export function OrgSettingsFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {SKELETON_FIELD_KEYS.map(key => (
          <div key={key} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full max-w-lg" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OrgSettingsForm({
  id,
  t,
  timezones,
  currencies,
  countries,
  months,
  register,
  handleSubmit,
  setValue,
  watch,
  onSubmit,
  errors,
  isDirty,
  isPending,
}: OrgSettingsFormProps) {
  const handleCountryChange = useCallback(
    (value: string | null) => {
      if (value) setValue('country', value, { shouldDirty: true });
    },
    [setValue],
  );
  const handleCurrencyChange = useCallback(
    (value: string | null) => {
      if (value) setValue('currency', value, { shouldDirty: true });
    },
    [setValue],
  );
  const handleTimezoneChange = useCallback(
    (value: string | null) => {
      if (value) setValue('timezone', value, { shouldDirty: true });
    },
    [setValue],
  );
  const handleLanguageChange = useCallback(
    (value: 'pl' | 'en' | 'ar' | 'de' | null) => {
      if (value) setValue('language', value, { shouldDirty: true });
    },
    [setValue],
  );
  const handleDateFormatChange = useCallback(
    (value: DateFormatKey | null) => {
      if (value) setValue('dateFormat', value, { shouldDirty: true });
    },
    [setValue],
  );
  const handleTimeFormatChange = useCallback(
    (value: TimeFormatKey | null) => {
      if (value) setValue('timeFormat', value, { shouldDirty: true });
    },
    [setValue],
  );
  const handleFiscalYearMonthChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      setValue('fiscalYearStartMonth', Number.parseInt(value, 10), { shouldDirty: true });
    },
    [setValue],
  );
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t('tabs.general')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 max-w-lg">
          {/* Organization name */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`} className="text-[13px]">
              {t('fields.orgName')}
            </Label>
            <Input id={`${id}-name`} disabled={isPending} {...register('name')} />
            {!!errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          {/* Legal name */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-legalName`} className="text-[13px]">
              {t('fields.legalName')}{' '}
              <span className="text-muted-foreground">{t('fields.legalNameOptional')}</span>
            </Label>
            <Input id={`${id}-legalName`} disabled={isPending} {...register('legalName')} />
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-country`} className="text-[13px]">
              {t('fields.country')}
            </Label>
            <Select
              value={watch('country')}
              onValueChange={handleCountryChange}
              disabled={isPending}
              items={countries}>
              <SelectTrigger id={`${id}-country`} className="w-full">
                <SelectValue placeholder={t('fields.countryPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {countries.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-currency`} className="text-[13px]">
              {t('fields.currency')}
            </Label>
            <Select
              value={watch('currency')}
              onValueChange={handleCurrencyChange}
              disabled={isPending}
              items={currencies}>
              <SelectTrigger id={`${id}-currency`} className="w-full">
                <SelectValue placeholder={t('fields.currencyPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {currencies.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-timezone`} className="text-[13px]">
              {t('fields.timezone')}
            </Label>
            <Select
              value={watch('timezone')}
              onValueChange={handleTimezoneChange}
              disabled={isPending}
              items={timezones}>
              <SelectTrigger id={`${id}-timezone`} className="w-full">
                <SelectValue placeholder={t('fields.timezonePlaceholder')} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {timezones.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-language`} className="text-[13px]">
              {t('fields.language')}
            </Label>
            <Select
              value={watch('language')}
              onValueChange={handleLanguageChange}
              disabled={isPending}
              items={[
                { value: 'pl', label: t('fields.languagePolish') },
                { value: 'en', label: t('fields.languageEnglish') },
                { value: 'de', label: t('fields.languageGerman') },
                { value: 'ar', label: t('fields.languageArabic') },
              ]}>
              <SelectTrigger id={`${id}-language`} className="w-full">
                <SelectValue placeholder={t('fields.languagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pl">{t('fields.languagePolish')}</SelectItem>
                <SelectItem value="en">{t('fields.languageEnglish')}</SelectItem>
                <SelectItem value="de">{t('fields.languageGerman')}</SelectItem>
                <SelectItem value="ar">{t('fields.languageArabic')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date format */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-dateFormat`} className="text-[13px]">
              {t('fields.dateFormat')}
            </Label>
            <Select
              value={watch('dateFormat')}
              onValueChange={handleDateFormatChange}
              disabled={isPending}
              items={DATE_FORMATS.map(fmt => ({
                value: fmt,
                label: `${fmt} — ${previewDateFormat(fmt)}`,
              }))}>
              <SelectTrigger id={`${id}-dateFormat`} className="w-full">
                <SelectValue placeholder={t('fields.dateFormatPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map(fmt => (
                  <SelectItem key={fmt} value={fmt}>
                    {fmt}
                    <span className="ms-2 text-muted-foreground">{previewDateFormat(fmt)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time format */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-timeFormat`} className="text-[13px]">
              {t('fields.timeFormat.label')}
            </Label>
            <Select
              value={watch('timeFormat')}
              onValueChange={handleTimeFormatChange}
              disabled={isPending}
              items={TIME_FORMATS.map(fmt => ({
                value: fmt,
                label: `${tDyn(t, 'fields.timeFormat', fmt === '24h' ? '24h' : '12h')} — ${previewTimeFormat(fmt)}`,
              }))}>
              <SelectTrigger id={`${id}-timeFormat`} className="w-full">
                <SelectValue placeholder={t('fields.timeFormat.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {TIME_FORMATS.map(fmt => (
                  <SelectItem key={fmt} value={fmt}>
                    {tDyn(t, 'fields.timeFormat', fmt === '24h' ? '24h' : '12h')}
                    <span className="ms-2 text-muted-foreground">{previewTimeFormat(fmt)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fiscal year start */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-fiscalYearStartMonth`} className="text-[13px]">
              {t('fields.fiscalYear')}
            </Label>
            <Select
              value={String(watch('fiscalYearStartMonth'))}
              onValueChange={handleFiscalYearMonthChange}
              disabled={isPending}
              items={months.map(m => ({ value: String(m.value), label: m.label }))}>
              <SelectTrigger id={`${id}-fiscalYearStartMonth`} className="w-full">
                <SelectValue placeholder={t('fields.fiscalYearPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Billing email */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-billingEmail`} className="text-[13px]">
              {t('fields.billingEmail')}{' '}
              <span className="text-muted-foreground">{t('fields.billingEmailOptional')}</span>
            </Label>
            <Input
              id={`${id}-billingEmail`}
              type="email"
              disabled={isPending}
              {...register('billingEmail')}
            />
            {!!errors.billingEmail && (
              <p className="text-sm text-destructive">{errors.billingEmail.message}</p>
            )}
          </div>
        </CardContent>

        {/* Consistent footer with save button */}
        <CardFooter>
          <Button type="submit" disabled={isPending || !isDirty}>
            {isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="me-2 h-4 w-4" />
            )}
            {isPending ? t('saving') : t('saveCta')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export function OrgSettingsFormSection() {
  const form = useOrgSettingsForm();
  const kleinunternehmer = useOrgKleinunternehmer();

  if (form.isLoading) return <OrgSettingsFormSkeleton />;
  return (
    <div className="space-y-6">
      <OrgSettingsForm {...form} />
      {!kleinunternehmer.isLoading && (
        <KleinunternehmerToggle
          orgCountryCode={kleinunternehmer.orgCountryCode}
          isKleinunternehmer={kleinunternehmer.isKleinunternehmer}
        />
      )}
    </div>
  );
}

/** @deprecated Use `OrgSettingsFormSection` — alias kept for minimal import churn */
export const OrgSettingsFormContainer = OrgSettingsFormSection;
