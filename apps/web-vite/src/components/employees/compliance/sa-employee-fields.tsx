import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { classifySaudiId, isValidGosi, saudizationBandEnum } from '@contractor-ops/validators';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EntityTypeSelect } from '../../contractors/compliance/entity-type-select.js';
import { EmployeePiiMaskedReveal } from './employee-pii-masked-reveal.js';
import type { PiiRevealContext } from './field-primitives.js';
import { AdvisoryPill, FieldError, RequiredLabel } from './field-primitives.js';

type SaudizationBand = (typeof saudizationBandEnum.options)[number];

export interface SaEmployeeFieldsProps {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  /** Plaintext Iqama / national ID being captured during registration. */
  iqama: string;
  onIqamaChange: (val: string) => void;
  /** When present (edit/post-register), the Iqama renders as a masked reveal. */
  reveal?: PiiRevealContext;
}

/**
 * Saudi Arabia fields: Saudization (Nitaqat) band, GOSI, Iqama.
 *
 * The Iqama is hard-validated (Luhn + leading digit); GOSI is a lenient,
 * adviser-verify format check that surfaces an amber advisory and never blocks.
 */
export function SaEmployeeFields({
  values,
  onChange,
  iqama,
  onIqamaChange,
  reveal,
}: SaEmployeeFieldsProps) {
  const t = useTranslations('Employees.compliance.sa');
  const id = useId();

  const handleBand = useCallback(
    (v: SaudizationBand) => onChange('saudizationCategory', v),
    [onChange],
  );
  const handleGosi = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange('gosiNumber', e.target.value || undefined),
    [onChange],
  );
  const handleIqama = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onIqamaChange(e.target.value),
    [onIqamaChange],
  );
  const renderBand = useCallback((v: SaudizationBand) => t(`saudizationBand.${v}`), [t]);

  const gosi = (values.gosiNumber as string | undefined) ?? '';
  const gosiAdvisory = gosi && !isValidGosi(gosi) ? t('gosiAdvisory') : undefined;

  const iqamaDigits = iqama.replace(/\D/g, '');
  const iqamaError =
    iqamaDigits.length >= 10 && classifySaudiId(iqama) === false
      ? t('iqamaFormatError')
      : undefined;

  return (
    <div className="space-y-4">
      <EntityTypeSelect<SaudizationBand>
        values={saudizationBandEnum.options}
        value={values.saudizationCategory as SaudizationBand | undefined}
        onChange={handleBand}
        label={t('saudizationCategoryLabel')}
        required
        renderOption={renderBand}
      />

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-gosi`}>{t('gosiNumberLabel')}</RequiredLabel>
        <Input
          id={`${id}-gosi`}
          inputMode="numeric"
          maxLength={9}
          placeholder={t('gosiNumberPlaceholder')}
          value={gosi}
          onChange={handleGosi}
        />
        {gosiAdvisory ? <AdvisoryPill message={gosiAdvisory} /> : null}
      </div>

      {reveal ? (
        <EmployeePiiMaskedReveal
          workerId={reveal.workerId}
          field="iqama"
          last4={reveal.last4}
          canReveal={reveal.canReveal}
        />
      ) : (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-iqama`}>{t('iqamaLabel')}</RequiredLabel>
          <Input
            id={`${id}-iqama`}
            inputMode="numeric"
            maxLength={10}
            aria-invalid={iqamaError ? 'true' : undefined}
            aria-describedby={iqamaError ? `${id}-iqama-error` : undefined}
            placeholder={t('iqamaPlaceholder')}
            value={iqama}
            onChange={handleIqama}
          />
          <FieldError id={`${id}-iqama-error`} message={iqamaError} />
        </div>
      )}
    </div>
  );
}
