import type { ComboboxOption } from '@contractor-ops/ui/components/reui/combobox';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { isValidPesel } from '@contractor-ops/validators';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EmployeePiiMaskedReveal } from './employee-pii-masked-reveal.js';
import type { PiiRevealContext } from './field-primitives.js';
import { AdviserVerifyNote, FieldError, RequiredLabel } from './field-primitives.js';
import { ReferenceListPicker } from './reference-list-picker.js';

export interface PlEmployeeFieldsProps {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  /** Plaintext PESEL being captured during registration. */
  pesel: string;
  onPeselChange: (val: string) => void;
  /** NFZ regional branch options from the reference-list query. */
  nfzOptions: readonly ComboboxOption[];
  /** When present (edit/post-register), the PESEL renders as a masked reveal. */
  reveal?: PiiRevealContext;
}

/** Poland statutory fields: job title, PESEL, payroll references, NFZ branch. */
export function PlEmployeeFields({
  values,
  onChange,
  pesel,
  onPeselChange,
  nfzOptions,
  reveal,
}: PlEmployeeFieldsProps) {
  const t = useTranslations('Employees.compliance.pl');
  const id = useId();

  const handleText = useCallback(
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(key, e.target.value || undefined),
    [onChange],
  );
  const handleNfz = useCallback((value: string) => onChange('nfzOddzial', value), [onChange]);
  const handlePesel = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPeselChange(e.target.value),
    [onPeselChange],
  );

  const peselDigits = pesel.replace(/\D/g, '');
  const peselError =
    peselDigits.length >= 11 && !isValidPesel(pesel) ? t('peselFormatError') : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-stanowisko`} required>
          {t('stanowiskoLabel')}
        </RequiredLabel>
        <Input
          id={`${id}-stanowisko`}
          aria-required="true"
          placeholder={t('stanowiskoPlaceholder')}
          value={(values.stanowisko as string | undefined) ?? ''}
          onChange={handleText('stanowisko')}
        />
      </div>

      {reveal ? (
        <EmployeePiiMaskedReveal
          workerId={reveal.workerId}
          field="pesel"
          last4={reveal.last4}
          canReveal={reveal.canReveal}
        />
      ) : (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-pesel`}>{t('peselLabel')}</RequiredLabel>
          <Input
            id={`${id}-pesel`}
            inputMode="numeric"
            maxLength={11}
            aria-invalid={peselError ? 'true' : undefined}
            aria-describedby={peselError ? `${id}-pesel-error` : undefined}
            placeholder={t('peselPlaceholder')}
            value={pesel}
            onChange={handlePesel}
          />
          <FieldError id={`${id}-pesel-error`} message={peselError} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-etat`}>{t('etatLabel')}</RequiredLabel>
          <Input
            id={`${id}-etat`}
            inputMode="decimal"
            placeholder={t('etatPlaceholder')}
            value={(values.etat as string | undefined) ?? ''}
            onChange={handleText('etat')}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-stawka`}>{t('stawkaBruttoLabel')}</RequiredLabel>
          <Input
            id={`${id}-stawka`}
            inputMode="decimal"
            placeholder={t('stawkaBruttoPlaceholder')}
            value={(values.stawkaBrutto as string | undefined) ?? ''}
            onChange={handleText('stawkaBrutto')}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-urzad`}>{t('urzadSkarbowyLabel')}</RequiredLabel>
          <Input
            id={`${id}-urzad`}
            inputMode="numeric"
            maxLength={4}
            placeholder={t('urzadSkarbowyPlaceholder')}
            value={(values.urzadSkarbowyCode as string | undefined) ?? ''}
            onChange={handleText('urzadSkarbowyCode')}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-zus`}>{t('zusTitleCodeLabel')}</RequiredLabel>
          <Input
            id={`${id}-zus`}
            inputMode="numeric"
            maxLength={6}
            placeholder={t('zusTitleCodePlaceholder')}
            value={(values.zusTitleCode as string | undefined) ?? ''}
            onChange={handleText('zusTitleCode')}
          />
        </div>
      </div>

      <ReferenceListPicker
        label={t('nfzOddzialLabel')}
        value={(values.nfzOddzial as string | undefined) ?? null}
        onValueChange={handleNfz}
        options={nfzOptions}
        placeholder={t('nfzOddzialPlaceholder')}
        searchPlaceholder={t('nfzOddzialSearch')}
        emptyLabel={t('nfzOddzialEmpty')}
        adviserNote={t('adviserVerifyNote')}
      />

      <AdviserVerifyNote>{t('statutoryNote')}</AdviserVerifyNote>
    </div>
  );
}
