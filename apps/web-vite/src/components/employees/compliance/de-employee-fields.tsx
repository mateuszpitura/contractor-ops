import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { Lohnsteuerklasse } from '@contractor-ops/validators';
import { isValidSteuerIdNr, isValidSvNummer, LOHNSTEUERKLASSE } from '@contractor-ops/validators';
import { useCallback, useId } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EntityTypeSelect } from '../../contractors/compliance/entity-type-select.js';
import { AdviserVerifyNote, FieldError, RequiredLabel } from './field-primitives.js';

export interface DeEmployeeFieldsProps {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}

/** Germany statutory fields: Lohnsteuerklasse, Steuer-IdNr, SV-Nummer, Krankenkasse. */
export function DeEmployeeFields({ values, onChange }: DeEmployeeFieldsProps) {
  const t = useTranslations('Employees.compliance.de');
  const id = useId();

  const handleText = useCallback(
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(key, e.target.value || undefined),
    [onChange],
  );
  const handleLohnsteuerklasse = useCallback(
    (v: Lohnsteuerklasse) => onChange('lohnsteuerklasse', v),
    [onChange],
  );
  const handleKirchensteuer = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange('kirchensteuer', e.target.checked),
    [onChange],
  );
  const handleKinderfreibetrag = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange('kinderfreibetrag', e.target.value === '' ? undefined : Number(e.target.value)),
    [onChange],
  );
  const renderKlasse = useCallback((v: Lohnsteuerklasse) => v, []);

  const steuerIdNr = (values.steuerIdNr as string | undefined) ?? '';
  const svNummer = (values.svNummer as string | undefined) ?? '';
  const steuerIdNrError =
    steuerIdNr.replace(/\D/g, '').length >= 11 && !isValidSteuerIdNr(steuerIdNr)
      ? t('steuerIdNrFormatError')
      : undefined;
  const svNummerError =
    svNummer.replace(/\D/g, '').length >= 12 && !isValidSvNummer(svNummer)
      ? t('svNummerFormatError')
      : undefined;

  return (
    <div className="space-y-4">
      <EntityTypeSelect<Lohnsteuerklasse>
        values={LOHNSTEUERKLASSE}
        value={values.lohnsteuerklasse as Lohnsteuerklasse | undefined}
        onChange={handleLohnsteuerklasse}
        label={t('lohnsteuerklasseLabel')}
        renderOption={renderKlasse}
      />

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-steuerid`}>{t('steuerIdNrLabel')}</RequiredLabel>
        <Input
          id={`${id}-steuerid`}
          inputMode="numeric"
          maxLength={11}
          aria-invalid={steuerIdNrError ? 'true' : undefined}
          aria-describedby={steuerIdNrError ? `${id}-steuerid-error` : undefined}
          placeholder={t('steuerIdNrPlaceholder')}
          value={steuerIdNr}
          onChange={handleText('steuerIdNr')}
        />
        <FieldError id={`${id}-steuerid-error`} message={steuerIdNrError} />
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-svnummer`}>{t('svNummerLabel')}</RequiredLabel>
        <Input
          id={`${id}-svnummer`}
          aria-invalid={svNummerError ? 'true' : undefined}
          aria-describedby={svNummerError ? `${id}-svnummer-error` : undefined}
          placeholder={t('svNummerPlaceholder')}
          value={svNummer}
          onChange={handleText('svNummer')}
        />
        <FieldError id={`${id}-svnummer-error`} message={svNummerError} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-krankenkasse`}>{t('krankenkasseLabel')}</RequiredLabel>
          <Input
            id={`${id}-krankenkasse`}
            inputMode="numeric"
            maxLength={8}
            placeholder={t('krankenkassePlaceholder')}
            value={(values.krankenkasse as string | undefined) ?? ''}
            onChange={handleText('krankenkasse')}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-kinderfreibetrag`}>
            {t('kinderfreibetragLabel')}
          </RequiredLabel>
          <Input
            id={`${id}-kinderfreibetrag`}
            type="number"
            min={0}
            max={20}
            step={0.5}
            placeholder={t('kinderfreibetragPlaceholder')}
            value={
              values.kinderfreibetrag === undefined ? '' : String(values.kinderfreibetrag as number)
            }
            onChange={handleKinderfreibetrag}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`${id}-kirchensteuer`}
          type="checkbox"
          className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
          checked={Boolean(values.kirchensteuer)}
          onChange={handleKirchensteuer}
        />
        <Label htmlFor={`${id}-kirchensteuer`} className="text-sm font-medium">
          {t('kirchensteuerLabel')}
        </Label>
      </div>

      <AdviserVerifyNote>{t('elstamNote')}</AdviserVerifyNote>
    </div>
  );
}
