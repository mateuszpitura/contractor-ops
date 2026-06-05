import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { BundeslandCode, DeCountryFields } from '@contractor-ops/validators';
import {
  deEntityTypeEnum,
  TAX_HANDELSREGISTER_LABEL,
  TAX_KLEINUNTERNEHMER_LABEL,
  TAX_SOZIALVERSICHERUNGSNUMMER_LABEL,
  TAX_STEUERNUMMER_LABEL,
  TAX_USTIDNR_LABEL,
} from '@contractor-ops/validators';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { BundeslandSelect } from './bundesland-select.js';
import { EntityTypeSelect } from './entity-type-select.js';
import type { HandelsregisterValue } from './handelsregister-input.js';
import { HandelsregisterInput } from './handelsregister-input.js';
import { SteuernummerInput } from './steuernummer-input.js';
import { VatRegisteredToggle } from './vat-registered-toggle.js';

type DeEntityType = DeCountryFields['entityType'];

const DE_ENTITY_LABELS: Record<DeEntityType, string> = {
  EINZELUNTERNEHMEN: 'Einzelunternehmen',
  GBR: 'GbR',
  OHG: 'OHG',
  KG: 'KG',
  UG: 'UG (haftungsbeschränkt)',
  GMBH: 'GmbH',
  AG: 'AG',
};

const ENTITIES_REQUIRING_HANDELSREGISTER: readonly DeEntityType[] = ['UG', 'GMBH', 'AG'] as const;
const ENTITIES_SHOWING_HANDELSREGISTER: readonly DeEntityType[] = [
  'OHG',
  'KG',
  'UG',
  'GMBH',
  'AG',
] as const;

export interface DeComplianceFieldsProps {
  values?: Partial<DeCountryFields>;
  onChange?: <K extends keyof DeCountryFields>(key: K, val: DeCountryFields[K] | undefined) => void;
  errors?: Partial<Record<keyof DeCountryFields, string>>;

  entityType?: DeEntityType;
  bundesland?: BundeslandCode;
  isVatRegistered?: boolean;
  isKleinunternehmer?: boolean;
  steuernummer?: string;
  ustIdNr?: string;
  handelsregister?: HandelsregisterValue;
  sozialversicherungsnummer?: string;
}

function collectShorthandProps(props: DeComplianceFieldsProps): Partial<DeCountryFields> {
  const result: Partial<DeCountryFields> = {};
  if (props.entityType !== undefined) result.entityType = props.entityType;
  if (props.bundesland !== undefined) result.bundesland = props.bundesland;
  if (props.isVatRegistered !== undefined) result.isVatRegistered = props.isVatRegistered;
  if (props.isKleinunternehmer !== undefined) result.isKleinunternehmer = props.isKleinunternehmer;
  if (props.steuernummer !== undefined) result.steuernummer = props.steuernummer;
  if (props.ustIdNr !== undefined) result.ustIdNr = props.ustIdNr;
  if (props.handelsregister !== undefined) result.handelsregister = props.handelsregister;
  if (props.sozialversicherungsnummer !== undefined)
    result.sozialversicherungsnummer = props.sozialversicherungsnummer;
  return result;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" aria-live="polite" className="text-xs text-destructive">
      {message}
    </p>
  );
}

type HandleChange = <K extends keyof DeCountryFields>(
  key: K,
  val: DeCountryFields[K] | undefined,
) => void;

function UstIdField({
  id,
  show,
  value,
  error,
  onChange,
}: {
  id: string;
  show: boolean;
  value: string | undefined;
  error: string | undefined;
  onChange: HandleChange;
}) {
  const t = useTranslations('Contractors.compliance.de');
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange('ustIdNr', e.target.value || undefined),
    [onChange],
  );
  if (!show) return null;
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-ust-id`} className="text-sm font-medium">
        {TAX_USTIDNR_LABEL}
        <span aria-hidden="true" className="ms-1 text-destructive">
          *
        </span>
      </Label>
      <Input
        id={`${id}-ust-id`}
        aria-required="true"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-ust-id-error` : undefined}
        placeholder={t('vatNumberPlaceholder')}
        value={value ?? ''}
        onChange={handleChange}
      />
      <FieldError id={`${id}-ust-id-error`} message={error} />
    </div>
  );
}

function SozialversicherungField({
  id,
  value,
  error,
  onChange,
}: {
  id: string;
  value: string | undefined;
  error: string | undefined;
  onChange: HandleChange;
}) {
  const t = useTranslations('Contractors.compliance.de');
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange('sozialversicherungsnummer', e.target.value || undefined),
    [onChange],
  );
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-sv`} className="text-sm font-medium">
        {TAX_SOZIALVERSICHERUNGSNUMMER_LABEL}
      </Label>
      <Input
        id={`${id}-sv`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-sv-error` : undefined}
        placeholder={t('steuernummerPlaceholder')}
        value={value ?? ''}
        onChange={handleChange}
      />
      <FieldError id={`${id}-sv-error`} message={error} />
    </div>
  );
}

export function DeComplianceFields(props: DeComplianceFieldsProps) {
  const t = useTranslations('Contractors.compliance.de');
  const id = useId();
  const [internal, setInternal] = useState<Partial<DeCountryFields>>({});

  const merged: Partial<DeCountryFields> = {
    ...internal,
    ...collectShorthandProps(props),
    ...(props.values ?? {}),
  };

  const handleChange = useCallback(
    <K extends keyof DeCountryFields>(key: K, val: DeCountryFields[K] | undefined) => {
      if (props.onChange) {
        props.onChange(key, val);
        return;
      }
      setInternal(prev => ({ ...prev, [key]: val }));
    },
    [props],
  );

  const handleBundeslandChange = useCallback(
    (v: BundeslandCode) => handleChange('bundesland', v),
    [handleChange],
  );
  const handleEntityTypeChange = useCallback(
    (v: DeEntityType) => handleChange('entityType', v),
    [handleChange],
  );
  const renderEntityOption = useCallback((v: DeEntityType) => DE_ENTITY_LABELS[v], []);
  const handleSteuernummerChange = useCallback(
    (v: string) => handleChange('steuernummer', v || undefined),
    [handleChange],
  );
  const handleVatRegisteredChange = useCallback(
    (v: boolean) => handleChange('isVatRegistered', v),
    [handleChange],
  );
  const handleKleinunternehmerChange = useCallback(
    (v: boolean) => handleChange('isKleinunternehmer', v),
    [handleChange],
  );
  const handleHandelsregisterChange = useCallback(
    (v: Partial<HandelsregisterValue> | undefined) =>
      handleChange('handelsregister', v as DeCountryFields['handelsregister']),
    [handleChange],
  );

  const entityType = merged.entityType;
  const bundesland = merged.bundesland;
  const isVatRegistered = merged.isVatRegistered ?? false;
  const isKleinunternehmer = merged.isKleinunternehmer ?? false;
  const errors = props.errors ?? {};

  const showUstId = isVatRegistered && !isKleinunternehmer;
  const showHandelsregister =
    entityType !== undefined && ENTITIES_SHOWING_HANDELSREGISTER.includes(entityType);
  const handelsregisterRequired =
    entityType !== undefined && ENTITIES_REQUIRING_HANDELSREGISTER.includes(entityType);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t('infoBoxTitle')}
        <ul className="mt-1 list-disc ps-5">
          <li>{t('infoItem1')}</li>
          <li>{t('infoItem2')}</li>
          <li>{t('infoItem3')}</li>
        </ul>
      </div>

      <BundeslandSelect
        value={bundesland}
        onChange={handleBundeslandChange}
        label={t('bundeslandLabel')}
        required
        error={errors.bundesland}
      />

      <EntityTypeSelect<DeEntityType>
        values={deEntityTypeEnum.options}
        value={entityType}
        onChange={handleEntityTypeChange}
        label={t('rechtsformLabel')}
        required
        error={errors.entityType}
        renderOption={renderEntityOption}
      />

      <SteuernummerInput
        bundesland={bundesland}
        value={merged.steuernummer}
        onChange={handleSteuernummerChange}
        label={TAX_STEUERNUMMER_LABEL}
        required
        error={errors.steuernummer}
      />

      <VatRegisteredToggle
        checked={isVatRegistered}
        onChange={handleVatRegisteredChange}
        label={t('vatRegisteredLabel')}
      />

      <VatRegisteredToggle
        checked={isKleinunternehmer}
        onChange={handleKleinunternehmerChange}
        label={TAX_KLEINUNTERNEHMER_LABEL}
      />

      <UstIdField
        id={id}
        show={showUstId}
        value={merged.ustIdNr}
        error={errors.ustIdNr}
        onChange={handleChange}
      />

      {showHandelsregister ? (
        <HandelsregisterInput
          value={merged.handelsregister}
          onChange={handleHandelsregisterChange}
          legend={TAX_HANDELSREGISTER_LABEL}
          required={handelsregisterRequired}
          error={errors.handelsregister}
        />
      ) : null}

      <SozialversicherungField
        id={id}
        value={merged.sozialversicherungsnummer}
        error={errors.sozialversicherungsnummer}
        onChange={handleChange}
      />
    </div>
  );
}
