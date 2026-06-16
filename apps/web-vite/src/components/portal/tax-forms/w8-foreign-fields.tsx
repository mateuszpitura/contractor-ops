import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { TaxFormStepProps } from './step-types.js';

type W8ForeignFieldsProps = Pick<TaxFormStepProps, 'fieldId' | 'register' | 'errors'>;

/**
 * Shared foreign permanent-residence address + FTIN fields for both W-8 forms
 * (IRS line 3 + line 5). Presentational: the parent step owns layout and the
 * treaty country select.
 */
export function W8ForeignFields({ fieldId, register, errors }: W8ForeignFieldsProps) {
  const t = useTranslations('TaxFormWizard.w8');

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-ftin`} className="font-normal text-sm">
          {t('ftinLabel')}
        </Label>
        <Input
          id={`${fieldId}-ftin`}
          className="font-mono"
          autoComplete="off"
          aria-invalid={'ftin' in errors}
          aria-describedby={'ftin' in errors ? `${fieldId}-ftin-error` : undefined}
          {...register('ftin')}
        />
        <p className="text-xs text-muted-foreground">{t('ftinHelp')}</p>
        {'ftin' in errors ? (
          <p id={`${fieldId}-ftin-error`} role="alert" className="text-sm text-destructive">
            {t('ftinRequired')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-addr1`} className="font-normal text-sm">
          {t('addressLine1Label')}
        </Label>
        <Input
          id={`${fieldId}-addr1`}
          autoComplete="address-line1"
          aria-invalid={'addressLine1' in errors}
          {...register('addressLine1')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-addr2`} className="font-normal text-sm">
          {t('addressLine2Label')}
        </Label>
        <Input id={`${fieldId}-addr2`} autoComplete="address-line2" {...register('addressLine2')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-city`} className="font-normal text-sm">
            {t('cityLabel')}
          </Label>
          <Input
            id={`${fieldId}-city`}
            autoComplete="address-level2"
            aria-invalid={'city' in errors}
            {...register('city')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-postal`} className="font-normal text-sm">
            {t('postalCodeLabel')}
          </Label>
          <Input id={`${fieldId}-postal`} autoComplete="postal-code" {...register('postalCode')} />
        </div>
      </div>
    </>
  );
}
