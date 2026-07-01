import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { StudentLoanPlan } from '@contractor-ops/validators';
import { isValidNiNumber, isValidUkTaxCode, STUDENT_LOAN_PLAN } from '@contractor-ops/validators';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EntityTypeSelect } from '../../contractors/compliance/entity-type-select.js';
import { FieldError, RequiredLabel } from './field-primitives.js';

export interface UkEmployeeFieldsProps {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}

/** United Kingdom PAYE fields: tax code, NI number, student-loan plan, pension. */
export function UkEmployeeFields({ values, onChange }: UkEmployeeFieldsProps) {
  const t = useTranslations('Employees.compliance.uk');
  const id = useId();

  const handleText = useCallback(
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(key, e.target.value || undefined),
    [onChange],
  );
  const handlePlan = useCallback(
    (v: StudentLoanPlan) => onChange('studentLoanPlan', v),
    [onChange],
  );
  const handlePension = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange('pensionEnrolled', e.target.checked),
    [onChange],
  );
  const renderPlan = useCallback((v: StudentLoanPlan) => t(`studentLoanPlan.${v}`), [t]);

  const taxCode = (values.taxCode as string | undefined) ?? '';
  const niNumber = (values.niNumber as string | undefined) ?? '';
  const taxCodeError = taxCode && !isValidUkTaxCode(taxCode) ? t('taxCodeFormatError') : undefined;
  const niError =
    niNumber.replace(/[\s-]/g, '').length >= 9 && !isValidNiNumber(niNumber)
      ? t('niFormatError')
      : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-taxcode`} required>
          {t('taxCodeLabel')}
        </RequiredLabel>
        <Input
          id={`${id}-taxcode`}
          aria-required="true"
          aria-invalid={taxCodeError ? 'true' : undefined}
          aria-describedby={taxCodeError ? `${id}-taxcode-error` : undefined}
          placeholder={t('taxCodePlaceholder')}
          value={taxCode}
          onChange={handleText('taxCode')}
        />
        <FieldError id={`${id}-taxcode-error`} message={taxCodeError} />
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-ni`}>{t('niNumberLabel')}</RequiredLabel>
        <Input
          id={`${id}-ni`}
          maxLength={13}
          aria-invalid={niError ? 'true' : undefined}
          aria-describedby={niError ? `${id}-ni-error` : undefined}
          placeholder={t('niNumberPlaceholder')}
          value={niNumber}
          onChange={handleText('niNumber')}
        />
        <FieldError id={`${id}-ni-error`} message={niError} />
      </div>

      <EntityTypeSelect<StudentLoanPlan>
        values={STUDENT_LOAN_PLAN}
        value={values.studentLoanPlan as StudentLoanPlan | undefined}
        onChange={handlePlan}
        label={t('studentLoanPlanLabel')}
        renderOption={renderPlan}
      />

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-paye`}>{t('payeReferenceLabel')}</RequiredLabel>
        <Input
          id={`${id}-paye`}
          placeholder={t('payeReferencePlaceholder')}
          value={(values.payeReference as string | undefined) ?? ''}
          onChange={handleText('payeReference')}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`${id}-pension`}
          type="checkbox"
          className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
          checked={Boolean(values.pensionEnrolled)}
          onChange={handlePension}
        />
        <Label htmlFor={`${id}-pension`} className="text-sm font-medium">
          {t('pensionEnrolledLabel')}
        </Label>
      </div>
    </div>
  );
}
