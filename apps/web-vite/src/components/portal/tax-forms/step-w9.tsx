import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { usEntityTypeEnum } from '@contractor-ops/validators';
import { ArrowRight } from 'lucide-react';
import { Controller } from 'react-hook-form';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TaxFormStepProps } from './step-types.js';

// Derived from the shared schema enum so the select offers exactly the entity
// types the validator accepts — no drift between UI and server.
const US_ENTITY_TYPES = usEntityTypeEnum.options;

/**
 * W-9 form step for US persons. Captures the entity classification, the EIN (the
 * SSN itself stays in its encrypted column — only the last-4 reference travels),
 * and the backup-withholding flag. The full SSN is never collected here.
 */
export function StepW9({
  fieldId,
  control,
  register,
  errors,
  onContinue,
  onBack,
}: TaxFormStepProps) {
  const t = useTranslations('TaxFormWizard.w9');
  const tEntity = useTranslations('TaxFormWizard.usEntityType');
  const tNav = useTranslations('TaxFormWizard.nav');

  return (
    <Card className="bg-card">
      <CardHeader className="space-y-1">
        <h2 className="font-display text-lg font-semibold leading-tight">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-card-gap" noValidate>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-entity`} className="font-normal text-sm">
              {t('entityTypeLabel')}
            </Label>
            <Controller
              control={control}
              name="usEntityType"
              // biome-ignore lint/nursery/noJsxPropsBind: react-hook-form Controller render prop — extraction is premature optimization
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={`${fieldId}-entity`}
                    className="w-full"
                    aria-invalid={'usEntityType' in errors}
                    aria-describedby={
                      'usEntityType' in errors ? `${fieldId}-entity-error` : undefined
                    }>
                    <SelectValue placeholder={t('entityTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {US_ENTITY_TYPES.map(option => (
                      <SelectItem key={option} value={option}>
                        {tEntity(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {'usEntityType' in errors ? (
              <p id={`${fieldId}-entity-error`} role="alert" className="text-sm text-destructive">
                {t('entityTypeRequired')}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-ein`} className="font-normal text-sm">
              {t('einLabel')}
            </Label>
            <Input
              id={`${fieldId}-ein`}
              className="font-mono tabular-nums"
              autoComplete="off"
              placeholder={t('einPlaceholder')}
              {...register('tin.ein')}
            />
            <p className="text-xs text-muted-foreground">{t('einHelp')}</p>
          </div>

          <div className="flex items-start gap-2">
            <Controller
              control={control}
              name="backupWithholding"
              // biome-ignore lint/nursery/noJsxPropsBind: react-hook-form Controller render prop — extraction is premature optimization
              render={({ field }) => (
                <Checkbox
                  id={`${fieldId}-backup`}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor={`${fieldId}-backup`} className="font-normal text-sm leading-snug">
              {t('backupWithholdingLabel')}
            </Label>
          </div>

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
