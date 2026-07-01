import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  aeVisaTypeEnum,
  isValidEmiratesId,
  isValidWpsEstablishmentId,
} from '@contractor-ops/validators';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EntityTypeSelect } from '../../contractors/compliance/entity-type-select.js';
import { EmployeePiiMaskedReveal } from './employee-pii-masked-reveal.js';
import type { PiiRevealContext } from './field-primitives.js';
import { AdvisoryPill, FieldError, RequiredLabel } from './field-primitives.js';

type AeVisaType = (typeof aeVisaTypeEnum.options)[number];

export interface AeEmployeeFieldsProps {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  /** Plaintext Emirates ID being captured during registration. */
  emiratesId: string;
  onEmiratesIdChange: (val: string) => void;
  /** When present (edit/post-register), the Emirates ID renders as a masked reveal. */
  reveal?: PiiRevealContext;
}

/**
 * United Arab Emirates fields: visa type, WPS establishment, Emirates ID.
 *
 * The Emirates-ID format gate is hard (red, blocks save); the checksum is
 * advisory only — a format-valid ID with a failing check digit surfaces an
 * amber pill and still saves.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one cohesive UAE field block — the branches are the Emirates-ID masked-reveal vs capture split plus the format-hard / checksum-advisory feedback ternaries; splitting would fragment a single field group.
export function AeEmployeeFields({
  values,
  onChange,
  emiratesId,
  onEmiratesIdChange,
  reveal,
}: AeEmployeeFieldsProps) {
  const t = useTranslations('Employees.compliance.ae');
  const id = useId();

  const handleVisaType = useCallback((v: AeVisaType) => onChange('visaType', v), [onChange]);
  const handleWps = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange('wpsEstablishmentId', e.target.value || undefined),
    [onChange],
  );
  const handleEmiratesId = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onEmiratesIdChange(e.target.value),
    [onEmiratesIdChange],
  );
  const renderVisaType = useCallback((v: AeVisaType) => t(`visaType.${v}`), [t]);

  const wps = (values.wpsEstablishmentId as string | undefined) ?? '';
  const wpsAdvisory = wps && !isValidWpsEstablishmentId(wps) ? t('wpsAdvisory') : undefined;

  const emiratesIdDigits = emiratesId.replace(/\D/g, '');
  const emiratesIdComplete = emiratesIdDigits.length >= 15;
  const emiratesIdResult = emiratesIdComplete ? isValidEmiratesId(emiratesId) : null;
  const emiratesIdFormatError =
    emiratesIdResult && !emiratesIdResult.formatValid ? t('emiratesIdFormatError') : undefined;
  const emiratesIdChecksumAdvisory =
    emiratesIdResult?.formatValid && !emiratesIdResult.checksumValid
      ? t('emiratesIdChecksumAdvisory')
      : undefined;

  return (
    <div className="space-y-4">
      <EntityTypeSelect<AeVisaType>
        values={aeVisaTypeEnum.options}
        value={values.visaType as AeVisaType | undefined}
        onChange={handleVisaType}
        label={t('visaTypeLabel')}
        required
        renderOption={renderVisaType}
      />

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-wps`}>{t('wpsEstablishmentIdLabel')}</RequiredLabel>
        <Input
          id={`${id}-wps`}
          inputMode="numeric"
          maxLength={13}
          placeholder={t('wpsEstablishmentIdPlaceholder')}
          value={wps}
          onChange={handleWps}
        />
        {wpsAdvisory ? <AdvisoryPill message={wpsAdvisory} /> : null}
      </div>

      {reveal ? (
        <EmployeePiiMaskedReveal
          workerId={reveal.workerId}
          field="emiratesId"
          last4={reveal.last4}
          canReveal={reveal.canReveal}
        />
      ) : (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-emirates`}>{t('emiratesIdLabel')}</RequiredLabel>
          <Input
            id={`${id}-emirates`}
            inputMode="numeric"
            maxLength={18}
            aria-invalid={emiratesIdFormatError ? 'true' : undefined}
            aria-describedby={emiratesIdFormatError ? `${id}-emirates-error` : undefined}
            placeholder={t('emiratesIdPlaceholder')}
            value={emiratesId}
            onChange={handleEmiratesId}
          />
          <FieldError id={`${id}-emirates-error`} message={emiratesIdFormatError} />
          {emiratesIdChecksumAdvisory ? (
            <AdvisoryPill message={emiratesIdChecksumAdvisory} />
          ) : null}
        </div>
      )}
    </div>
  );
}
