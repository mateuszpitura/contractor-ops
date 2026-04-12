'use client';

import { useCallback, useState } from 'react';
import {
  ukEntityTypeEnum,
  type UkCountryFields,
} from '@contractor-ops/validators';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { EntityTypeSelect } from './entity-type-select';
import { VatRegisteredToggle } from './vat-registered-toggle';

type UkEntityType = UkCountryFields['entityType'];

/**
 * Canonical human-readable labels for UK entity types.
 *
 * Kept as a map here — not in `messages/*.json` — because the underlying enum
 * values (`SOLE_TRADER`, `LTD`, `LLP`) are stable domain codes the schema
 * depends on. Translations can replace this map later without changing the
 * wire format.
 */
const UK_ENTITY_LABELS: Record<UkEntityType, string> = {
  SOLE_TRADER: 'Sole trader',
  LTD: 'Limited company (Ltd)',
  LLP: 'Limited liability partnership (LLP)',
};

export interface UkComplianceFieldsProps {
  /**
   * Form state. When a `values` record is provided, its keys take precedence
   * over the individual shorthand props (`entityType`, `isVatRegistered`, …).
   * The component is fully controlled when `onChange` is supplied; when
   * `onChange` is omitted, an internal state store is used so the component is
   * also usable in isolation (primarily for scaffold tests and Storybook).
   */
  values?: Partial<UkCountryFields>;
  onChange?: <K extends keyof UkCountryFields>(
    key: K,
    val: UkCountryFields[K] | undefined,
  ) => void;
  errors?: Partial<Record<keyof UkCountryFields, string>>;

  // Shorthand props — convenience form for tests and storybook. Equivalent to
  // passing a `values` record with the same keys. Present on the component so
  // <UkComplianceFields entityType="LTD" isVatRegistered={false} /> works in
  // the Wave 0 scaffold without a surrounding form provider.
  entityType?: UkEntityType;
  isVatRegistered?: boolean;
  utr?: string;
  companiesHouseNumber?: string;
  vatRegistrationNumber?: string;
}

/**
 * UK contractor compliance field group (FOUND-01 / D-14).
 *
 * Composes the generic primitives in this folder into the UK field matrix
 * described in UI-SPEC §Interaction 1:
 *   - SOLE_TRADER  → UTR required, Companies House hidden
 *   - LTD / LLP    → Companies House required, UTR optional
 *   - isVatRegistered=true in any case → VAT registration number required
 *
 * Required fields render a destructive asterisk next to their label and set
 * `aria-required="true"` on the underlying control. The Zod schema re-asserts
 * the same rules server-side (`ukCountryFieldsSchema.superRefine`), so the UI
 * markers are strictly a usability signal.
 */
export function UkComplianceFields(props: UkComplianceFieldsProps) {
  const [internal, setInternal] = useState<Partial<UkCountryFields>>({});
  const merged: Partial<UkCountryFields> = {
    ...internal,
    ...(props.entityType !== undefined ? { entityType: props.entityType } : {}),
    ...(props.isVatRegistered !== undefined
      ? { isVatRegistered: props.isVatRegistered }
      : {}),
    ...(props.utr !== undefined ? { utr: props.utr } : {}),
    ...(props.companiesHouseNumber !== undefined
      ? { companiesHouseNumber: props.companiesHouseNumber }
      : {}),
    ...(props.vatRegistrationNumber !== undefined
      ? { vatRegistrationNumber: props.vatRegistrationNumber }
      : {}),
    ...(props.values ?? {}),
  };

  const handleChange = useCallback(
    <K extends keyof UkCountryFields>(
      key: K,
      val: UkCountryFields[K] | undefined,
    ) => {
      if (props.onChange) {
        props.onChange(key, val);
        return;
      }
      setInternal(prev => ({ ...prev, [key]: val }));
    },
    [props],
  );

  const entityType = merged.entityType;
  const isVatRegistered = merged.isVatRegistered ?? false;
  const errors = props.errors ?? {};

  const isSoleTrader = entityType === 'SOLE_TRADER';
  const isLtdOrLlp = entityType === 'LTD' || entityType === 'LLP';
  const utrRequired = isSoleTrader;
  const chRequired = isLtdOrLlp;
  const vatRequired = isVatRegistered;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        UK identifiers — required fields depend on entity type:
        <ul className="mt-1 list-disc ps-5">
          <li>Sole traders must provide a UTR.</li>
          <li>Limited companies (Ltd / LLP) must provide a Companies House number.</li>
          <li>VAT-registered contractors must provide a VAT registration number.</li>
        </ul>
      </div>

      <EntityTypeSelect<UkEntityType>
        values={ukEntityTypeEnum.options}
        value={entityType}
        onChange={v => handleChange('entityType', v)}
        label="Entity type"
        required
        error={errors.entityType}
        renderOption={v => UK_ENTITY_LABELS[v]}
      />

      <div className="space-y-2">
        <Label htmlFor="uk-utr" className="text-sm font-medium">
          UTR
          {utrRequired ? (
            <span aria-hidden="true" className="ms-1 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        <Input
          id="uk-utr"
          inputMode="numeric"
          maxLength={10}
          aria-required={utrRequired ? 'true' : undefined}
          aria-invalid={errors.utr ? 'true' : undefined}
          aria-describedby={errors.utr ? 'uk-utr-error' : undefined}
          placeholder="10-digit UTR"
          value={merged.utr ?? ''}
          onChange={e => handleChange('utr', e.target.value || undefined)}
        />
        {errors.utr ? (
          <p id="uk-utr-error" role="alert" aria-live="polite" className="text-xs text-destructive">
            {errors.utr}
          </p>
        ) : null}
      </div>

      {isLtdOrLlp ? (
        <div className="space-y-2">
          <Label htmlFor="uk-ch" className="text-sm font-medium">
            Companies House number
            {chRequired ? (
              <span aria-hidden="true" className="ms-1 text-destructive">
                *
              </span>
            ) : null}
          </Label>
          <Input
            id="uk-ch"
            maxLength={8}
            aria-required={chRequired ? 'true' : undefined}
            aria-invalid={errors.companiesHouseNumber ? 'true' : undefined}
            aria-describedby={
              errors.companiesHouseNumber ? 'uk-ch-error' : undefined
            }
            placeholder="e.g. 12345678 or SC123456"
            value={merged.companiesHouseNumber ?? ''}
            onChange={e =>
              handleChange('companiesHouseNumber', e.target.value || undefined)
            }
          />
          {errors.companiesHouseNumber ? (
            <p
              id="uk-ch-error"
              role="alert"
              aria-live="polite"
              className="text-xs text-destructive">
              {errors.companiesHouseNumber}
            </p>
          ) : null}
        </div>
      ) : null}

      <VatRegisteredToggle
        checked={isVatRegistered}
        onChange={v => handleChange('isVatRegistered', v)}
        label="VAT registered"
      />

      {isVatRegistered ? (
        <div className="space-y-2">
          <Label htmlFor="uk-vat" className="text-sm font-medium">
            VAT registration number
            {vatRequired ? (
              <span aria-hidden="true" className="ms-1 text-destructive">
                *
              </span>
            ) : null}
          </Label>
          <Input
            id="uk-vat"
            aria-required={vatRequired ? 'true' : undefined}
            aria-invalid={errors.vatRegistrationNumber ? 'true' : undefined}
            aria-describedby={
              errors.vatRegistrationNumber ? 'uk-vat-error' : undefined
            }
            placeholder="GB123456789"
            value={merged.vatRegistrationNumber ?? ''}
            onChange={e =>
              handleChange(
                'vatRegistrationNumber',
                e.target.value || undefined,
              )
            }
          />
          {errors.vatRegistrationNumber ? (
            <p
              id="uk-vat-error"
              role="alert"
              aria-live="polite"
              className="text-xs text-destructive">
              {errors.vatRegistrationNumber}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
