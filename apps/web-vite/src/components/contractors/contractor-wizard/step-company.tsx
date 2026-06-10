import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import { contractorTypeEnum } from '@contractor-ops/validators';
import { Loader2 } from 'lucide-react';
import { useCallback, useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { useContractorCompanyLookup as UseContractorCompanyLookup } from '../hooks/use-contractor-wizard.js';
import { useContractorCompanyLookup } from '../hooks/use-contractor-wizard.js';
import type { WizardFormValues } from './wizard-dialog.js';

interface StepCompanyViewProps {
  form: UseFormReturn<WizardFormValues>;
  lookup: ReturnType<typeof UseContractorCompanyLookup>['lookup'];
  isLookupLoading: boolean;
}

/**
 * Step 1: Company details with NIP autofill from the configured Polish
 * company registry (Dataport in dev, GUS BIR1 in prod).
 * Fields: NIP, legal name, type, email, VAT-EU, address.
 */
export function StepCompanyView({ form, lookup, isLookupLoading }: StepCompanyViewProps) {
  const id = useId();
  const t = useTranslations('ContractorWizard.fields');

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const nipValue = watch('taxId');

  const handleCompanyLookup = useCallback(() => {
    void lookup(nipValue ?? '', setValue);
  }, [lookup, nipValue, setValue]);

  const handleTypeChange = useCallback(
    (value: string) =>
      setValue('type', value as WizardFormValues['type'], {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [setValue],
  );

  return (
    <div className="space-y-4">
      {/* NIP with GUS autofill */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-taxId`} className="text-[13px]">
          {t('nip')}
        </Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-taxId`}
            className="flex-1 font-mono"
            placeholder="0000000000"
            {...register('taxId')}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            onClick={handleCompanyLookup}
            disabled={isLookupLoading}>
            {isLookupLoading ? (
              <>
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                {t('nipFetching')}
              </>
            ) : (
              t('nipFetch')
            )}
          </Button>
        </div>
        {!!errors.taxId && <p className="text-sm text-destructive">{errors.taxId.message}</p>}
      </div>

      {/* Legal name */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-legalName`} className="text-[13px]">
          {t('legalName')}
        </Label>
        <Input id={`${id}-legalName`} {...register('legalName')} />
        {!!errors.legalName && (
          <p className="text-sm text-destructive">{errors.legalName.message}</p>
        )}
      </div>

      {/* Contractor type */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('type')}</Label>
        <RadioGroup value={watch('type') ?? ''} onValueChange={handleTypeChange}>
          {contractorTypeEnum.options.map(type => (
            <label
              key={type}
              htmlFor={`${id}-contractor-type-${type}`}
              className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm hover:bg-accent/50 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5">
              <RadioGroupItem id={`${id}-contractor-type-${type}`} value={type} />
              <span>{tDynLoose(t, 'typeOptions', enumKey(type))}</span>
            </label>
          ))}
        </RadioGroup>
        {!!errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      {/* Contact email */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-email`} className="text-[13px]">
          {t('email')}
        </Label>
        <Input id={`${id}-email`} type="email" {...register('email')} />
        {!!errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      {/* VAT-EU (optional) */}
      <div className="space-y-2">
        <Label htmlFor={`${id}-vatId`} className="text-[13px]">
          {t('vatId')}
        </Label>
        <Input id={`${id}-vatId`} {...register('vatId')} />
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('address')}</Label>
        <div className="space-y-2">
          <Input placeholder={t('addressLine1')} {...register('addressLine1')} />
          <Input placeholder={t('addressLine2')} {...register('addressLine2')} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={t('city')} {...register('city')} />
            <Input placeholder={t('postalCode')} {...register('postalCode')} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StepCompany({ form }: { form: UseFormReturn<WizardFormValues> }) {
  const { lookup, isLookupLoading } = useContractorCompanyLookup();
  return <StepCompanyView form={form} lookup={lookup} isLookupLoading={isLookupLoading} />;
}
