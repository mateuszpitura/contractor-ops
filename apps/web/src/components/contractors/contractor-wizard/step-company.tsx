'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';
import type { WizardFormValues } from './wizard-dialog';
import { tDyn, tDynLoose } from '@/i18n/typed-keys';

interface StepCompanyProps {
  form: UseFormReturn<WizardFormValues>;
}

const CONTRACTOR_TYPES = ['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER'] as const;

/**
 * Step 1: Company details with NIP autofill from the configured Polish
 * company registry (Dataport in dev, GUS BIR1 in prod).
 * Fields: NIP, legal name, type, email, VAT-EU, address.
 */
export function StepCompany({ form }: StepCompanyProps) {
  const id = useId();
  const t = useTranslations('ContractorWizard.fields');
  const tv = useTranslations('Validation.contractor');

  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const nipValue = watch('taxId');

  const handleCompanyLookup = async () => {
    const cleanNip = (nipValue ?? '').replace(/[\s-]/g, '');
    if (cleanNip.length !== 10) {
      toast.error(tv('nipFormat'));
      return;
    }

    setIsLookupLoading(true);
    try {
      const data = (await queryClient.fetchQuery(
        trpc.contractor.companyLookup.queryOptions({ nip: cleanNip }),
      )) as Record<string, unknown>;

      if (data?.found) {
        const fieldMap: [string, keyof WizardFormValues][] = [
          ['legalName', 'legalName'],
          ['legalName', 'displayName'],
          ['regon', 'registrationNumber'],
          ['addressLine1', 'addressLine1'],
          ['city', 'city'],
          ['postalCode', 'postalCode'],
        ];
        for (const [sourceKey, targetKey] of fieldMap) {
          if (data[sourceKey]) {
            setValue(targetKey, String(data[sourceKey]), { shouldDirty: true });
          }
        }
        toast.success(t('nipSuccess'));
      } else {
        toast.error(t('nipError'));
      }
    } catch {
      toast.error(t('nipError'));
    } finally {
      setIsLookupLoading(false);
    }
  };

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
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
        <RadioGroup
          value={watch('type') ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onValueChange={value =>
            setValue('type', value as WizardFormValues['type'], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }>
          {CONTRACTOR_TYPES.map(type => (
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
