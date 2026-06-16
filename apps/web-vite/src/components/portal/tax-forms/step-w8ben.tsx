import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { ArrowRight } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TaxFormW8StepProps } from './step-types.js';
import { TreatyClaimCaption } from './treaty-claim-caption.js';
import { W8ForeignFields } from './w8-foreign-fields.js';

/**
 * W-8BEN form step for foreign individuals. The treaty article + rate
 * auto-populate from the determination and are announced via aria-live. The
 * contractor confirms their treaty country and foreign residence.
 */
export function StepW8Ben({
  fieldId,
  control: _control,
  setValue: _setValue,
  register,
  errors,
  treatyClaim,
  onContinue,
  onBack,
}: TaxFormW8StepProps) {
  const t = useTranslations('TaxFormWizard.w8ben');
  const tW8 = useTranslations('TaxFormWizard.w8');
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
