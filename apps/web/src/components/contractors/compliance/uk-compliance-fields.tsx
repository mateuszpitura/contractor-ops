'use client';

import type { UkCountryFields } from '@contractor-ops/validators';
import { ukEntityTypeEnum } from '@contractor-ops/validators';
import { useCallback, useId, useState } from 'react';

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
   * over the individual shorthand props (`entityType`, `isVatRegistered`, ...).
   * The component is fully controlled when `onChange` is supplied; when
   * `onChange` is omitted, an internal state store is used so the component is
   * also usable in isolation (primarily for scaffold tests and Storybook).
   */
  values?: Partial<UkCountryFields>;
  onChange?: <K extends keyof UkCountryFields>(key: K, val: UkCountryFields[K] | undefined) => void;
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
 * described in UI-SPEC Interaction 1:
 *   - SOLE_TRADER  -> UTR required, Companies House hidden
 *   - LTD / LLP    -> Companies House required, UTR optional
 *   - isVatRegistered=true in any case -> VAT registration number required
 *
 * Required fields render a destructive asterisk next to their label and set
 * `aria-required="true"` on the underlying control. The Zod schema re-asserts
 * the same rules server-side (`ukCountryFieldsSchema.superRefine`), so the UI
 * markers are strictly a usability signal.
 */
/** Merge shorthand props into a partial record, skipping undefined values. */
function collectShorthandProps(props: UkComplianceFieldsProps): Partial<UkCountryFields> {
  const result: Partial<UkCountryFields> = {};
  if (props.entityType !== undefined) result.entityType = props.entityType;
  if (props.isVatRegistered !== undefined) result.isVatRegistered = props.isVatRegistered;
  if (props.utr !== undefined) result.utr = props.utr;
  if (props.companiesHouseNumber !== undefined)
    result.companiesHouseNumber = props.companiesHouseNumber;
  if (props.vatRegistrationNumber !== undefined)
    result.vatRegistrationNumber = props.vatRegistrationNumber;
  return result;
}

/** Required-field label with optional asterisk. */
function RequiredLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {required ? (
        <span aria-hidden="true" className="ms-1 text-destructive">
          *
        </span>
      ) : null}
    </Label>
  );
}

/** Inline field error with ARIA attributes. */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" aria-live="polite" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function UkComplianceFields(props: UkComplianceFieldsProps) {
  const id = useId();
  const [internal, setInternal] = useState<Partial<UkCountryFields>>({});
  const merged: Partial<UkCountryFields> = {
    ...internal,
    ...collectShorthandProps(props),
    ...(props.values ?? {}),
  };

  const handleChange = useCallback(
    <K extends keyof UkCountryFields>(key: K, val: UkCountryFields[K] | undefined) => {
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

  const isLtdOrLlp = entityType === 'LTD' || entityType === 'LLP';
  const utrRequired = entityType === 'SOLE_TRADER';
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
        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
        onChange={v => handleChange('entityType', v)}
        label="Entity type"
        required
        error={errors.entityType}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        renderOption={v => UK_ENTITY_LABELS[v]}
      />

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-utr`} required={utrRequired}>
          UTR
        </RequiredLabel>
        <Input
          id={`${id}-utr`}
          inputMode="numeric"
          maxLength={10}
          aria-required={utrRequired ? 'true' : undefined}
          aria-invalid={errors.utr ? 'true' : undefined}
          aria-describedby={errors.utr ? `${id}-utr-error` : undefined}
          placeholder="10-digit UTR"
          value={merged.utr ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => handleChange('utr', e.target.value || undefined)}
        />
        <FieldError id={`${id}-utr-error`} message={errors.utr} />
      </div>

      {isLtdOrLlp ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-ch`} required={chRequired}>
            Companies House number
          </RequiredLabel>
          <Input
            id={`${id}-ch`}
            maxLength={8}
            aria-required={chRequired ? 'true' : undefined}
            aria-invalid={errors.companiesHouseNumber ? 'true' : undefined}
            aria-describedby={errors.companiesHouseNumber ? `${id}-ch-error` : undefined}
            placeholder="e.g. 12345678 or SC123456"
            value={merged.companiesHouseNumber ?? ''}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => handleChange('companiesHouseNumber', e.target.value || undefined)}
          />
          <FieldError id={`${id}-ch-error`} message={errors.companiesHouseNumber} />
        </div>
      ) : null}

      <VatRegisteredToggle
        checked={isVatRegistered}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
        onChange={v => handleChange('isVatRegistered', v)}
        label="VAT registered"
      />

      {isVatRegistered ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-vat`} required={vatRequired}>
            VAT registration number
          </RequiredLabel>
          <Input
            id={`${id}-vat`}
            aria-required={vatRequired ? 'true' : undefined}
            aria-invalid={errors.vatRegistrationNumber ? 'true' : undefined}
            aria-describedby={errors.vatRegistrationNumber ? `${id}-vat-error` : undefined}
            placeholder="GB123456789"
            value={merged.vatRegistrationNumber ?? ''}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => handleChange('vatRegistrationNumber', e.target.value || undefined)}
          />
          <FieldError id={`${id}-vat-error`} message={errors.vatRegistrationNumber} />
        </div>
      ) : null}
    </div>
  );
}
