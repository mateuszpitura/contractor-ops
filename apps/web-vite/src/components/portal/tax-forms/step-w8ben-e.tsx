import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { ArrowRight } from 'lucide-react';
import { Controller } from 'react-hook-form';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TaxFormW8StepProps } from './step-types.js';
import { TreatyClaimCaption } from './treaty-claim-caption.js';
import { W8ForeignFields } from './w8-foreign-fields.js';

const ENTITY_TYPES = [
  'CORPORATION',
  'PARTNERSHIP',
  'DISREGARDED_ENTITY',
  'TRUST',
  'ESTATE',
  'GOVERNMENT',
  'CENTRAL_BANK_OF_ISSUE',
  'TAX_EXEMPT_ORGANIZATION',
  'PRIVATE_FOUNDATION',
  'INTERNATIONAL_ORGANIZATION',
] as const;

const LOB_CATEGORIES = [
  'GOVERNMENT',
  'TAX_EXEMPT_PENSION_TRUST',
  'OTHER_TAX_EXEMPT_ORGANIZATION',
  'PUBLICLY_TRADED_CORPORATION',
  'SUBSIDIARY_OF_PUBLICLY_TRADED_CORPORATION',
  'COMPANY_MEETS_OWNERSHIP_BASE_EROSION_TEST',
  'COMPANY_MEETS_DERIVATIVE_BENEFITS_TEST',
  'COMPANY_WITH_ITEM_OF_INCOME_MEETS_ACTIVE_TRADE_BUSINESS_TEST',
  'FAVORABLE_DISCRETIONARY_DETERMINATION',
  'OTHER',
] as const;

/**
 * W-8BEN-E form step for foreign entities. Adds the chapter-3 entity
 * classification and the limitation-on-benefits (LOB) category to the W-8BEN
 * surface. The treaty article + rate auto-populate and are announced via
 * aria-live.
 */
export function StepW8BenE({
  fieldId,
  control,
  setValue: _setValue,
  register,
  errors,
  treatyClaim,
  onContinue,
  onBack,
}: TaxFormW8StepProps) {
  const t = useTranslations('TaxFormWizard.w8bene');
  const tW8 = useTranslations('TaxFormWizard.w8');
  const tEntity = useTranslations('TaxFormWizard.entityType');
  const tLob = useTranslations('TaxFormWizard.lobCategory');
  const tNav = useTranslations('TaxFormWizard.nav');
  const country = treatyClaim?.residency ?? '';

  return (
    <Card className="bg-card">
      <CardHeader className="space-y-1">
        <h2 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-card-gap" noValidate>
          <TreatyClaimCaption treatyClaim={treatyClaim} country={country} />

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-country`} className="font-normal text-sm">
              {tW8('treatyCountryLabel')}
            </Label>
            <Input
              id={`${fieldId}-country`}
              className="font-mono uppercase"
              maxLength={2}
              autoComplete="country"
              aria-invalid={'treatyCountry' in errors}
              {...register('treatyCountry')}
            />
            <p className="text-xs text-muted-foreground">{tW8('treatyCountryHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-entity`} className="font-normal text-sm">
              {t('entityTypeLabel')}
            </Label>
            <Controller
              control={control}
              name="entityType"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={`${fieldId}-entity`}
                    className="w-full"
                    aria-invalid={'entityType' in errors}>
                    <SelectValue placeholder={t('entityTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(option => (
                      <SelectItem key={option} value={option}>
                        {tEntity(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-lob`} className="font-normal text-sm">
              {t('lobCategoryLabel')}
            </Label>
            <Controller
              control={control}
              name="lobCategory"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={`${fieldId}-lob`}
                    className="w-full"
                    aria-invalid={'lobCategory' in errors}>
                    <SelectValue placeholder={t('lobCategoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {LOB_CATEGORIES.map(option => (
                      <SelectItem key={option} value={option}>
                        {tLob(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">{t('lobCategoryHelp')}</p>
          </div>

          <W8ForeignFields fieldId={fieldId} register={register} errors={errors} />

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="button" className="w-full sm:flex-1" onClick={onContinue}>
              {tNav('continueToCertify')}
              <ArrowRight className="ms-2 size-4 rtl:rotate-180" aria-hidden />
            </Button>
            <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onBack}>
              {tNav('back')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
