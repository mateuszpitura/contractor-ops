// Step 11 codemod port from apps/web/src/components/contractors/compliance/uk-compliance-fields.tsx.

import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { UkCountryFields } from '@contractor-ops/validators';
import { ukEntityTypeEnum } from '@contractor-ops/validators';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { EntityTypeSelect } from './entity-type-select.js';
import { VatRegisteredToggle } from './vat-registered-toggle.js';

type UkEntityType = UkCountryFields['entityType'];

const UK_ENTITY_LABELS: Record<UkEntityType, string> = {
  SOLE_TRADER: 'Sole trader',
  LTD: 'Limited company (Ltd)',
  LLP: 'Limited liability partnership (LLP)',
};

export interface UkComplianceFieldsProps {
  values?: Partial<UkCountryFields>;
  onChange?: <K extends keyof UkCountryFields>(key: K, val: UkCountryFields[K] | undefined) => void;
  errors?: Partial<Record<keyof UkCountryFields, string>>;

  entityType?: UkEntityType;
  isVatRegistered?: boolean;
  utr?: string;
  companiesHouseNumber?: string;
  vatRegistrationNumber?: string;
}

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

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" aria-live="polite" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function UkComplianceFields(props: UkComplianceFieldsProps) {
  const t = useTranslations('Contractors.compliance.uk');
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
        {t('infoBoxTitle')}
        <ul className="mt-1 list-disc ps-5">
          <li>{t('infoItem1')}</li>
          <li>{t('infoItem2')}</li>
          <li>{t('infoItem3')}</li>
        </ul>
      </div>

      <EntityTypeSelect<UkEntityType>
        values={ukEntityTypeEnum.options}
        value={entityType}
        // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
        onChange={v => handleChange('entityType', v)}
        label={t('entityTypeLabel')}
        required
        error={errors.entityType}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        renderOption={v => UK_ENTITY_LABELS[v]}
      />

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-utr`} required={utrRequired}>
          {t('utrLabel')}
        </RequiredLabel>
        <Input
          id={`${id}-utr`}
          inputMode="numeric"
          maxLength={10}
          aria-required={utrRequired ? 'true' : undefined}
          aria-invalid={errors.utr ? 'true' : undefined}
          aria-describedby={errors.utr ? `${id}-utr-error` : undefined}
          placeholder={t('utrPlaceholder')}
          value={merged.utr ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => handleChange('utr', e.target.value || undefined)}
        />
        <FieldError id={`${id}-utr-error`} message={errors.utr} />
      </div>

      {isLtdOrLlp ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-ch`} required={chRequired}>
            {t('companiesHouseLabel')}
          </RequiredLabel>
          <Input
            id={`${id}-ch`}
            maxLength={8}
            aria-required={chRequired ? 'true' : undefined}
            aria-invalid={errors.companiesHouseNumber ? 'true' : undefined}
            aria-describedby={errors.companiesHouseNumber ? `${id}-ch-error` : undefined}
            placeholder={t('companiesHousePlaceholder')}
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
        label={t('vatRegisteredLabel')}
      />

      {isVatRegistered ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={`${id}-vat`} required={vatRequired}>
            {t('vatNumberLabel')}
          </RequiredLabel>
          <Input
            id={`${id}-vat`}
            aria-required={vatRequired ? 'true' : undefined}
            aria-invalid={errors.vatRegistrationNumber ? 'true' : undefined}
            aria-describedby={errors.vatRegistrationNumber ? `${id}-vat-error` : undefined}
            placeholder={t('vatNumberPlaceholder')}
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
