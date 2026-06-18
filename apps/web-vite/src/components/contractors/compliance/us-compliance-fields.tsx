import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { UsCountryFields } from '@contractor-ops/validators';
import { isValidEin, isValidSsn, usEntityTypeEnum } from '@contractor-ops/validators';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { UspsAddressStatus } from '../usps-address-status-pill.js';
import { UspsAddressStatusPill } from '../usps-address-status-pill.js';
import { EntityTypeSelect } from './entity-type-select.js';
import { SsnMaskedReveal } from './ssn-masked-reveal.js';

type UsEntityType = UsCountryFields['entityType'];

const ENTITY_LABEL_KEYS: Record<UsEntityType, string> = {
  SOLE_PROPRIETOR: 'entitySoleProprietor',
  LLC: 'entityLlc',
  C_CORP: 'entityCCorp',
  S_CORP: 'entitySCorp',
  PARTNERSHIP: 'entityPartnership',
  INDIVIDUAL: 'entityIndividual',
};

const ENTITIES_REQUIRING_EIN: readonly UsEntityType[] = [
  'LLC',
  'C_CORP',
  'S_CORP',
  'PARTNERSHIP',
] as const;

export interface UsComplianceFieldsProps {
  contractorId: string;
  values?: Partial<UsCountryFields>;
  onChange?: (key: string, val: unknown) => void;
  errors?: Partial<Record<string, string>>;
  /** Last four digits of an already-stored SSN — switches the SSN surface to masked-reveal. */
  ssnLast4?: string;
  /** Whether the active role holds `contractorPii:read` (controls reveal availability). */
  canRevealSsn?: boolean;
  /** Advisory USPS status for the saved address. */
  uspsStatus?: UspsAddressStatus;
  uspsValidatedAt?: Date | string | null;
  /** USPS-normalized address (CASS) when it differs from the entered one — advisory only. */
  uspsSuggestion?: { addressLine1: string; city: string; state: string; zipCode: string } | null;
  onAcceptUspsSuggestion?: () => void;
  onKeepEnteredAddress?: () => void;
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

/**
 * US contractor compliance fields.
 *
 * Mirrors UkComplianceFields: a dashed info box, then a `space-y-4` stack in
 * order — entity type → EIN → SSN → US address (with the advisory USPS pill +
 * normalized-suggestion box). The SSN surface is `SsnMaskedReveal` once a value
 * is stored, and a plain entry input otherwise. EIN/SSN format errors surface
 * inline via FieldError and never block typing.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: single cohesive US compliance form — complexity is conditional EIN/SSN surface rendering plus per-field aria and inline format-error ternaries; splitting would fragment one form without reducing real logic
export function UsComplianceFields(props: UsComplianceFieldsProps) {
  const t = useTranslations('Contractors.compliance.us');
  const id = useId();
  const [internal, setInternal] = useState<Record<string, unknown>>({});

  const merged: Record<string, unknown> = {
    ...internal,
    ...((props.values ?? {}) as Record<string, unknown>),
  };

  const handleChange = useCallback(
    (key: string, val: unknown) => {
      if (props.onChange) {
        props.onChange(key, val);
        return;
      }
      setInternal(prev => ({ ...prev, [key]: val }));
    },
    [props],
  );

  const handleEntityTypeChange = useCallback(
    (v: UsEntityType) => handleChange('entityType', v),
    [handleChange],
  );
  const renderEntityOption = useCallback((v: UsEntityType) => t(ENTITY_LABEL_KEYS[v]), [t]);

  const handleEinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('ein', e.target.value || undefined),
    [handleChange],
  );
  const handleSsnChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('ssn', e.target.value || undefined),
    [handleChange],
  );
  const handleAddressChange = useCallback(
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      handleChange(key, e.target.value || undefined),
    [handleChange],
  );

  const entityType = merged.entityType as UsEntityType | undefined;
  const errors = props.errors ?? {};

  const einValue = (merged.ein as string | undefined) ?? '';
  const ssnValue = (merged.ssn as string | undefined) ?? '';
  const einRequired = entityType ? ENTITIES_REQUIRING_EIN.includes(entityType) : false;

  // Inline, non-blocking validation — surfaced only once the user has typed a
  // complete-looking value, so it never fires mid-keystroke.
  const einError =
    errors.ein ?? (einValue && !isValidEin(einValue) ? t('einFormatError') : undefined);
  const ssnError =
    errors.ssn ??
    (ssnValue && ssnValue.length >= 9 && !isValidSsn(ssnValue) ? t('ssnFormatError') : undefined);

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

      <EntityTypeSelect<UsEntityType>
        values={usEntityTypeEnum.options}
        value={entityType}
        onChange={handleEntityTypeChange}
        label={t('entityTypeLabel')}
        required
        error={errors.entityType}
        renderOption={renderEntityOption}
      />

      <div className="space-y-2">
        <RequiredLabel htmlFor={`${id}-ein`} required={einRequired}>
          {t('einLabel')}
        </RequiredLabel>
        <Input
          id={`${id}-ein`}
          inputMode="numeric"
          maxLength={10}
          aria-required={einRequired ? 'true' : undefined}
          aria-invalid={einError ? 'true' : undefined}
          aria-describedby={einError ? `${id}-ein-error` : undefined}
          placeholder={t('einPlaceholder')}
          value={einValue}
          onChange={handleEinChange}
        />
        <FieldError id={`${id}-ein-error`} message={einError} />
      </div>

      {props.ssnLast4 ? (
        <SsnMaskedReveal
          contractorId={props.contractorId}
          last4={props.ssnLast4}
          canReveal={props.canRevealSsn ?? false}
        />
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${id}-ssn`} className="text-sm font-medium">
            {t('ssnLabel')}
          </Label>
          <Input
            id={`${id}-ssn`}
            inputMode="numeric"
            maxLength={11}
            aria-invalid={ssnError ? 'true' : undefined}
            aria-describedby={ssnError ? `${id}-ssn-error` : undefined}
            placeholder={t('ssnPlaceholder')}
            value={ssnValue}
            onChange={handleSsnChange}
          />
          <FieldError id={`${id}-ssn-error`} message={ssnError} />
        </div>
      )}

      <section className="space-y-3 border-t pt-4" aria-label={t('addressHeading')}>
        <h3 className="text-sm font-semibold">{t('addressHeading')}</h3>

        <div className="space-y-2">
          <Label htmlFor={`${id}-addr1`} className="text-sm font-medium">
            {t('addressLine1Label')}
          </Label>
          <Input
            id={`${id}-addr1`}
            placeholder={t('addressLine1Placeholder')}
            value={(merged.addressLine1 as string | undefined) ?? ''}
            onChange={handleAddressChange('addressLine1')}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor={`${id}-city`} className="text-sm font-medium">
              {t('cityLabel')}
            </Label>
            <Input
              id={`${id}-city`}
              placeholder={t('cityPlaceholder')}
              value={(merged.city as string | undefined) ?? ''}
              onChange={handleAddressChange('city')}
            />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor={`${id}-state`} className="text-sm font-medium">
              {t('stateLabel')}
            </Label>
            <Input
              id={`${id}-state`}
              maxLength={2}
              placeholder={t('statePlaceholder')}
              value={(merged.state as string | undefined) ?? ''}
              onChange={handleAddressChange('state')}
            />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor={`${id}-zip`} className="text-sm font-medium">
              {t('zipLabel')}
            </Label>
            <Input
              id={`${id}-zip`}
              inputMode="numeric"
              placeholder={t('zipPlaceholder')}
              value={(merged.zipCode as string | undefined) ?? ''}
              onChange={handleAddressChange('zipCode')}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3" data-testid="usps-validation-section">
          <Label className="text-sm font-medium">{t('uspsValidationLabel')}</Label>
          <UspsAddressStatusPill
            status={props.uspsStatus ?? null}
            validatedAt={props.uspsValidatedAt ?? null}
          />
        </div>

        {props.uspsSuggestion ? (
          <div
            className="space-y-2 rounded-md border bg-muted/30 p-3"
            data-testid="usps-suggestion-box">
            <p className="text-xs font-medium text-muted-foreground">
              {t('uspsSuggestionHeading')}
            </p>
            <p className="text-sm">
              {props.uspsSuggestion.addressLine1}, {props.uspsSuggestion.city},{' '}
              {props.uspsSuggestion.state} {props.uspsSuggestion.zipCode}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={props.onAcceptUspsSuggestion}>
                {t('uspsAcceptSuggestion')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={props.onKeepEnteredAddress}>
                {t('uspsKeepEntered')}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
