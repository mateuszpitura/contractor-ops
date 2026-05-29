import type { ZatcaTaxDetails } from '@contractor-ops/einvoice/zatca/schemas';
import { zatcaTaxDetailsSchema } from '@contractor-ops/einvoice/zatca/schemas';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useCallback, useId } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import type { useTaxDetailsForm } from './hooks/use-tax-details-form.js';

// ---------------------------------------------------------------------------
// Invoice types field renderer
// ---------------------------------------------------------------------------

interface InvoiceTypesFieldProps {
  field: ControllerRenderProps<ZatcaTaxDetails, 'invoiceTypes'>;
  reactId: string;
  labelStandard: string;
  labelSimplified: string;
}

function InvoiceTypesField({
  field,
  reactId,
  labelStandard,
  labelSimplified,
}: InvoiceTypesFieldProps) {
  const handleStandardChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      const current = field.value ?? [];
      field.onChange(checked ? [...current, 'standard'] : current.filter(v => v !== 'standard'));
    },
    [field],
  );
  const handleSimplifiedChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      const current = field.value ?? [];
      field.onChange(
        checked ? [...current, 'simplified'] : current.filter(v => v !== 'simplified'),
      );
    },
    [field],
  );
  return (
    <div className="space-y-2">
      <label htmlFor={`${reactId}-zatca-inv-standard`} className="flex items-center gap-2 text-sm">
        <Checkbox
          id={`${reactId}-zatca-inv-standard`}
          checked={field.value?.includes('standard')}
          onCheckedChange={handleStandardChange}
        />
        {labelStandard}
      </label>
      <label
        htmlFor={`${reactId}-zatca-inv-simplified`}
        className="flex items-center gap-2 text-sm">
        <Checkbox
          id={`${reactId}-zatca-inv-simplified`}
          checked={field.value?.includes('simplified')}
          onCheckedChange={handleSimplifiedChange}
        />
        {labelSimplified}
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type TaxDetailsFormViewProps = {
  defaultValues?: Partial<ZatcaTaxDetails>;
  onSuccess: () => void;
  onCancel: () => void;
} & ReturnType<typeof useTaxDetailsForm>;

// ---------------------------------------------------------------------------
// Tax Details Form — Step 1
// ---------------------------------------------------------------------------

/**
 * Step 1 of ZATCA onboarding wizard.
 * Collects VAT number (15-digit ^3\d{13}3$), Arabic org name, Saudi address,
 * and invoice types (standard / simplified).
 * Validates client-side with Zod schema, then calls trpc.zatca.saveTaxDetails.
 */
export function TaxDetailsFormView({
  defaultValues,
  onCancel,
  submitTaxDetails,
  isPending,
  t,
}: TaxDetailsFormViewProps) {
  const reactId = useId();
  const labelStandard = t('standardInvoice');
  const labelSimplified = t('simplifiedInvoice');
  const renderInvoiceTypes = useCallback(
    ({ field }: { field: ControllerRenderProps<ZatcaTaxDetails, 'invoiceTypes'> }) => (
      <InvoiceTypesField
        field={field}
        reactId={reactId}
        labelStandard={labelStandard}
        labelSimplified={labelSimplified}
      />
    ),
    [reactId, labelStandard, labelSimplified],
  );
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ZatcaTaxDetails>({
    resolver: zodResolver(zatcaTaxDetailsSchema),
    defaultValues: {
      vatNumber: '',
      orgNameArabic: '',
      street: '',
      city: '',
      district: '',
      postalCode: '',
      invoiceTypes: ['standard', 'simplified'],
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(submitTaxDetails)} className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {/* VAT Registration Number */}
      <div className="space-y-2">
        <Label htmlFor={`${reactId}-vatNumber`}>{t('vatNumber')}</Label>
        <Input
          id={`${reactId}-vatNumber`}
          placeholder={t('vatNumberPlaceholder')}
          maxLength={15}
          {...register('vatNumber')}
          aria-invalid={!!errors.vatNumber}
          aria-describedby={errors.vatNumber ? `${reactId}-vatNumber-error` : undefined}
        />
        {!!errors.vatNumber && (
          <p id={`${reactId}-vatNumber-error`} className="text-xs text-destructive">
            {errors.vatNumber.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t('vatNumberHint')}</p>
      </div>

      {/* Organization Legal Name (Arabic) */}
      <div className="space-y-2">
        <Label htmlFor={`${reactId}-orgNameArabic`}>{t('orgNameArabic')}</Label>
        <Input
          id={`${reactId}-orgNameArabic`}
          dir="rtl"
          placeholder="..."
          {...register('orgNameArabic')}
          aria-invalid={!!errors.orgNameArabic}
          aria-describedby={errors.orgNameArabic ? `${reactId}-orgNameArabic-error` : undefined}
        />
        {!!errors.orgNameArabic && (
          <p id={`${reactId}-orgNameArabic-error`} className="text-xs text-destructive">
            {errors.orgNameArabic.message}
          </p>
        )}
      </div>

      {/* Address Fields */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">{t('addressSection')}</legend>

        <div className="space-y-2">
          <Label htmlFor={`${reactId}-street`}>{t('street')}</Label>
          <Input id={`${reactId}-street`} {...register('street')} aria-invalid={!!errors.street} />
          {!!errors.street && <p className="text-xs text-destructive">{errors.street.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${reactId}-city`}>{t('city')}</Label>
            <Input id={`${reactId}-city`} {...register('city')} aria-invalid={!!errors.city} />
            {!!errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${reactId}-district`}>{t('district')}</Label>
            <Input
              id={`${reactId}-district`}
              {...register('district')}
              aria-invalid={!!errors.district}
            />
            {!!errors.district && (
              <p className="text-xs text-destructive">{errors.district.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${reactId}-postalCode`}>{t('postalCode')}</Label>
          <Input
            id={`${reactId}-postalCode`}
            maxLength={5}
            className="max-w-32"
            {...register('postalCode')}
            aria-invalid={!!errors.postalCode}
          />
          {!!errors.postalCode && (
            <p className="text-xs text-destructive">{errors.postalCode.message}</p>
          )}
        </div>
      </fieldset>

      {/* Invoice Types */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t('invoiceTypesSection')}</legend>

        <Controller control={control} name="invoiceTypes" render={renderInvoiceTypes} />
        {!!errors.invoiceTypes && (
          <p className="text-xs text-destructive">{errors.invoiceTypes.message}</p>
        )}
      </fieldset>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {!!isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {t('next')}
        </Button>
      </div>
    </form>
  );
}
