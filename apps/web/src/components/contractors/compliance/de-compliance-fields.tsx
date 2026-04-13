'use client';

import type { BundeslandCode, DeCountryFields } from '@contractor-ops/validators';
import {
  deEntityTypeEnum,
  TAX_HANDELSREGISTER_LABEL,
  TAX_KLEINUNTERNEHMER_LABEL,
  TAX_SOZIALVERSICHERUNGSNUMMER_LABEL,
  TAX_STEUERNUMMER_LABEL,
  TAX_USTIDNR_LABEL,
} from '@contractor-ops/validators';
import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { BundeslandSelect } from './bundesland-select';
import { EntityTypeSelect } from './entity-type-select';
import type { HandelsregisterValue } from './handelsregister-input';
import { HandelsregisterInput } from './handelsregister-input';
import { SteuernummerInput } from './steuernummer-input';
import { VatRegisteredToggle } from './vat-registered-toggle';

type DeEntityType = DeCountryFields['entityType'];

/**
 * Canonical DE entity-type labels.
 *
 * Kept verbatim German here — these are legal forms (Rechtsformen) with fixed
 * national names, not translatable marketing copy. Keeping them in code avoids
 * translation files ever drifting out of sync with the Zod enum.
 */
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

  // Shorthand props — see `UkComplianceFieldsProps` for the rationale.
  entityType?: DeEntityType;
  bundesland?: BundeslandCode;
  isVatRegistered?: boolean;
  isKleinunternehmer?: boolean;
  steuernummer?: string;
  ustIdNr?: string;
  handelsregister?: HandelsregisterValue;
  sozialversicherungsnummer?: string;
}

/**
 * DE contractor compliance field group (FOUND-02 + FOUND-04 label surface).
 *
 * Rendering rules (UI-SPEC §Interaction 1):
 *   - Steuernummer: always required; placeholder / helper / regex dispatch on
 *     the selected Bundesland.
 *   - Kleinunternehmer: Switch bound to `TAX_KLEINUNTERNEHMER_LABEL`.
 *   - USt-IdNr: visible iff `isVatRegistered && !isKleinunternehmer`.
 *   - Handelsregister: visible for capital companies (UG/GmbH/AG) and
 *     partnerships that may register (OHG/KG). Required for UG/GmbH/AG.
 *   - Sozialversicherungsnummer: optional, visible for all entity types.
 *
 * Every tax label rendered here is imported verbatim as a typed constant from
 * `@contractor-ops/validators/legal/de` — never translated, never duplicated
 * as a string literal. The CI guard (Plan 03) will fail the build if any of
 * these identifiers appears in `messages/*.json`.
 */
export function DeComplianceFields(props: DeComplianceFieldsProps) {
  const [internal, setInternal] = useState<Partial<DeCountryFields>>({});

  const merged: Partial<DeCountryFields> = {
    ...internal,
    ...(props.entityType === undefined ? {} : { entityType: props.entityType }),
    ...(props.bundesland === undefined ? {} : { bundesland: props.bundesland }),
    ...(props.isVatRegistered === undefined ? {} : { isVatRegistered: props.isVatRegistered }),
    ...(props.isKleinunternehmer === undefined
      ? {}
      : { isKleinunternehmer: props.isKleinunternehmer }),
    ...(props.steuernummer === undefined ? {} : { steuernummer: props.steuernummer }),
    ...(props.ustIdNr === undefined ? {} : { ustIdNr: props.ustIdNr }),
    ...(props.handelsregister === undefined ? {} : { handelsregister: props.handelsregister }),
    ...(props.sozialversicherungsnummer === undefined
      ? {}
      : { sozialversicherungsnummer: props.sozialversicherungsnummer }),
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
        DE-Identifikatoren — Pflichtfelder richten sich nach Rechtsform und USt-Status:
        <ul className="mt-1 list-disc ps-5">
          <li>Bundesland und Steuernummer sind immer erforderlich.</li>
          <li>UG, GmbH und AG: Handelsregisternummer erforderlich.</li>
          <li>Umsatzsteuerpflichtig (kein Kleinunternehmer): USt-IdNr erforderlich.</li>
        </ul>
      </div>

      <BundeslandSelect
        value={bundesland}
        onChange={v => handleChange('bundesland', v)}
        label="Bundesland"
        required
        error={errors.bundesland}
      />

      <EntityTypeSelect<DeEntityType>
        values={deEntityTypeEnum.options}
        value={entityType}
        onChange={v => handleChange('entityType', v)}
        label="Rechtsform"
        required
        error={errors.entityType}
        renderOption={v => DE_ENTITY_LABELS[v]}
      />

      <SteuernummerInput
        bundesland={bundesland}
        value={merged.steuernummer}
        onChange={v => handleChange('steuernummer', v || undefined)}
        label={TAX_STEUERNUMMER_LABEL}
        required
        error={errors.steuernummer}
      />

      <VatRegisteredToggle
        checked={isVatRegistered}
        onChange={v => handleChange('isVatRegistered', v)}
        label="Umsatzsteuerpflichtig"
      />

      <VatRegisteredToggle
        checked={isKleinunternehmer}
        onChange={v => handleChange('isKleinunternehmer', v)}
        label={TAX_KLEINUNTERNEHMER_LABEL}
      />

      {showUstId ? (
        <div className="space-y-2">
          <Label htmlFor="de-ust-id" className="text-sm font-medium">
            {TAX_USTIDNR_LABEL}
            <span aria-hidden="true" className="ms-1 text-destructive">
              *
            </span>
          </Label>
          <Input
            id="de-ust-id"
            aria-required="true"
            aria-invalid={errors.ustIdNr ? 'true' : undefined}
            aria-describedby={errors.ustIdNr ? 'de-ust-id-error' : undefined}
            placeholder="DE123456789"
            value={merged.ustIdNr ?? ''}
            onChange={e => handleChange('ustIdNr', e.target.value || undefined)}
          />
          {errors.ustIdNr ? (
            <p
              id="de-ust-id-error"
              role="alert"
              aria-live="polite"
              className="text-xs text-destructive">
              {errors.ustIdNr}
            </p>
          ) : null}
        </div>
      ) : null}

      {showHandelsregister ? (
        <HandelsregisterInput
          value={merged.handelsregister}
          onChange={v => handleChange('handelsregister', v as DeCountryFields['handelsregister'])}
          legend={TAX_HANDELSREGISTER_LABEL}
          required={handelsregisterRequired}
          error={errors.handelsregister}
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="de-sv" className="text-sm font-medium">
          {TAX_SOZIALVERSICHERUNGSNUMMER_LABEL}
        </Label>
        <Input
          id="de-sv"
          aria-invalid={errors.sozialversicherungsnummer ? 'true' : undefined}
          aria-describedby={errors.sozialversicherungsnummer ? 'de-sv-error' : undefined}
          placeholder="12 345678 A 901"
          value={merged.sozialversicherungsnummer ?? ''}
          onChange={e => handleChange('sozialversicherungsnummer', e.target.value || undefined)}
        />
        {errors.sozialversicherungsnummer ? (
          <p id="de-sv-error" role="alert" aria-live="polite" className="text-xs text-destructive">
            {errors.sozialversicherungsnummer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
