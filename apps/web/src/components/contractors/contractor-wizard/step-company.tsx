'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { trpc } from '@/trpc/init';

import type { WizardFormValues } from './wizard-dialog';

interface StepCompanyProps {
  form: UseFormReturn<WizardFormValues>;
}

const CONTRACTOR_TYPES = ['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER'] as const;

/**
 * Step 1: Company details with GUS NIP autofill.
 * Fields: NIP, legal name, type, email, VAT-EU, address.
 */
export function StepCompany({ form }: StepCompanyProps) {
  const t = useTranslations('ContractorWizard.fields');
  const tv = useTranslations('Validation.contractor');

  const [isGusLoading, setIsGusLoading] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const nipValue = watch('taxId');

  const handleGusLookup = async () => {
    const cleanNip = (nipValue ?? '').replace(/[\s-]/g, '');
    if (cleanNip.length !== 10) {
      toast.error(tv('nipFormat'));
      return;
    }

    setIsGusLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await queryClient.fetchQuery(
        trpc.contractor.gusLookup.queryOptions({ nip: cleanNip }),
      )) as Record<string, any>;

      if (data?.found) {
        if (data.legalName) {
          setValue('legalName', data.legalName, { shouldDirty: true });
          setValue('displayName', data.legalName, { shouldDirty: true });
        }
        if (data.regon) {
          setValue('registrationNumber', data.regon, { shouldDirty: true });
        }
        if (data.addressLine1) {
          setValue('addressLine1', data.addressLine1, { shouldDirty: true });
        }
        if (data.city) {
          setValue('city', data.city, { shouldDirty: true });
        }
        if (data.postalCode) {
          setValue('postalCode', data.postalCode, { shouldDirty: true });
        }
        toast.success(t('nipSuccess'));
      } else {
        toast.error(t('nipError'));
      }
    } catch {
      toast.error(t('nipError'));
    } finally {
      setIsGusLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* NIP with GUS autofill */}
      <div className="space-y-2">
        <Label htmlFor="taxId" className="text-[13px]">
          {t('nip')}
        </Label>
        <div className="flex gap-2">
          <Input
            id="taxId"
            className="flex-1 font-mono"
            placeholder="0000000000"
            {...register('taxId')}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            onClick={handleGusLookup}
            disabled={isGusLoading}>
            {isGusLoading ? (
              <>
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                {t('nipFetching')}
              </>
            ) : (
              t('nipFetch')
            )}
          </Button>
        </div>
        {errors.taxId && <p className="text-sm text-destructive">{errors.taxId.message}</p>}
      </div>

      {/* Legal name */}
      <div className="space-y-2">
        <Label htmlFor="legalName" className="text-[13px]">
          {t('legalName')}
        </Label>
        <Input id="legalName" {...register('legalName')} />
        {errors.legalName && <p className="text-sm text-destructive">{errors.legalName.message}</p>}
      </div>

      {/* Contractor type */}
      <div className="space-y-2">
        <Label className="text-[13px]">{t('type')}</Label>
        <RadioGroup
          value={watch('type') ?? ''}
          onValueChange={value =>
            setValue('type', value as WizardFormValues['type'], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }>
          {CONTRACTOR_TYPES.map(type => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm hover:bg-accent/50 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5">
              <RadioGroupItem value={type} />
              <span>{t(`typeOptions.${type}`)}</span>
            </label>
          ))}
        </RadioGroup>
        {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      {/* Contact email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[13px]">
          {t('email')}
        </Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      {/* VAT-EU (optional) */}
      <div className="space-y-2">
        <Label htmlFor="vatId" className="text-[13px]">
          {t('vatId')}
        </Label>
        <Input id="vatId" {...register('vatId')} />
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
