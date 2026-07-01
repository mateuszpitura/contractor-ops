import { Input } from '@contractor-ops/ui/components/shadcn/input';
import type { UsWithholdingState, W4FilingStatus } from '@contractor-ops/validators';
import { isValidSsn, US_WITHHOLDING_STATES, W4_FILING_STATUS } from '@contractor-ops/validators';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EntityTypeSelect } from '../../contractors/compliance/entity-type-select.js';
import { EmployeePiiMaskedReveal } from './employee-pii-masked-reveal.js';
import type { PiiRevealContext } from './field-primitives.js';
import { FieldError, RequiredLabel } from './field-primitives.js';

export interface UsEmployeeFieldsProps {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  /** Plaintext SSN being captured during registration. */
  ssn: string;
  onSsnChange: (val: string) => void;
  /** When present (edit/post-register), the SSN renders as a masked reveal. */
  reveal?: PiiRevealContext;
}

/** United States fields: W-4 filing status, state withholding, SSN. */
export function UsEmployeeFields({
  values,
  onChange,
  ssn,
  onSsnChange,
  reveal,
}: UsEmployeeFieldsProps) {
  const t = useTranslations('Employees.compliance.us');
  const id = useId();

  const handleFilingStatus = useCallback(
    (v: W4FilingStatus) => onChange('filingStatus', v),
    [onChange],
  );
  const handleState = useCallback(
    (v: UsWithholdingState) => onChange('stateWithholding', v),
    [onChange],
  );
  const handleStateOther = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange('stateOther', e.target.value || undefined),
    [onChange],
  );
  const handleSsn = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSsnChange(e.target.value),
    [onSsnChange],
  );
  const renderFilingStatus = useCallback((v: W4FilingStatus) => t(`filingStatus.${v}`), [t]);
  const renderState = useCallback(
    (v: UsWithholdingState) => (v === 'OTHER' ? t('stateOtherOption') : v),
    [t],
  );

  const stateWithholding = values.stateWithholding as UsWithholdingState | undefined;
  const ssnDigits = ssn.replace(/\D/g, '');
  const ssnError = ssnDigits.length >= 9 && !isValidSsn(ssn) ? t('ssnFormatError') : undefined;

  return (
    <div className="space-y-4">
      <EntityTypeSelect<W4FilingStatus>
        values={W4_FILING_STATUS}
        value={values.filingStatus as W4FilingStatus | undefined}
        onChange={handleFilingStatus}
        label={t('filingStatusLabel')}
        required
        renderOption={renderFilingStatus}
      />

      <EntityTypeSelect<UsWithholdingState>
        values={US_WITHHOLDING_STATES}
        value={stateWithholding}
        onChange={handleState}
        label={t('stateWithholdingLabel')}
        required
        renderOption={renderState}
      />

      {stateWithholding === 'OTHER' ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-state-other`} required>
            {t('stateOtherLabel')}
          </RequiredLabel>
          <Input
            id={`${id}-state-other`}
            aria-required="true"
            maxLength={100}
            placeholder={t('stateOtherPlaceholder')}
            value={(values.stateOther as string | undefined) ?? ''}
            onChange={handleStateOther}
          />
        </div>
      ) : null}

      {reveal ? (
        <EmployeePiiMaskedReveal
          workerId={reveal.workerId}
          field="ssn"
          last4={reveal.last4}
          canReveal={reveal.canReveal}
        />
      ) : (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-ssn`}>{t('ssnLabel')}</RequiredLabel>
          <Input
            id={`${id}-ssn`}
            inputMode="numeric"
            maxLength={11}
            aria-invalid={ssnError ? 'true' : undefined}
            aria-describedby={ssnError ? `${id}-ssn-error` : undefined}
            placeholder={t('ssnPlaceholder')}
            value={ssn}
            onChange={handleSsn}
          />
          <FieldError id={`${id}-ssn-error`} message={ssnError} />
        </div>
      )}
    </div>
  );
}
