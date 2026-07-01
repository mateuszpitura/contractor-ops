import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import {
  classifySaudiId,
  employeeCountryFieldsSchemaMap,
  isValidEmiratesId,
  isValidPesel,
  isValidSsn,
} from '@contractor-ops/validators';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { EntityTypeSelect } from '../../contractors/compliance/entity-type-select.js';
import { AeEmployeeFields } from './ae-employee-fields.js';
import { DeEmployeeFields } from './de-employee-fields.js';
import type { PiiRevealContext } from './field-primitives.js';
import { AdviserVerifyNote, AdvisoryPill, RequiredLabel } from './field-primitives.js';
import { useEmployeeCompliance } from './hooks/use-employee-compliance.js';
import { PlEmployeeFields } from './pl-employee-fields.js';
import { SaEmployeeFields } from './sa-employee-fields.js';
import { UkEmployeeFields } from './uk-employee-fields.js';
import { UsEmployeeFields } from './us-employee-fields.js';

const REGISTRY_COUNTRY_CODES = ['PL', 'DE', 'GB', 'US', 'AE', 'SA'] as const;
type RegistryCountryCode = (typeof REGISTRY_COUNTRY_CODES)[number];

const REQUIRED_FIELDS: Record<RegistryCountryCode, readonly string[]> = {
  PL: ['stanowisko'],
  DE: [],
  GB: ['taxCode'],
  US: ['filingStatus', 'stateWithholding'],
  AE: ['visaType'],
  SA: ['saudizationCategory'],
};

interface PiiValues {
  pesel: string;
  ssn: string;
  iqama: string;
  emiratesId: string;
}

const EMPTY_PII: PiiValues = { pesel: '', ssn: '', iqama: '', emiratesId: '' };

/** Registration response fields the reveal surface reads (encrypted blobs omitted). */
interface RegisteredEmployee {
  workerId: string;
  peselLast4?: string | null;
  ssnLast4?: string | null;
  iqamaLast4?: string | null;
  emiratesIdLast4?: string | null;
  checksumAdvisory?: string;
}

export function EmployeeComplianceLoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      </CardContent>
    </Card>
  );
}

function stripEmpty(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === '') continue;
    out[key] = value;
  }
  return out;
}

/** The single encrypted national ID each market captures, keyed for the register input. */
function piiInputFor(
  countryCode: RegistryCountryCode,
  pii: PiiValues,
): { pesel?: string; ssn?: string; iqama?: string; emiratesId?: string } {
  switch (countryCode) {
    case 'PL':
      return pii.pesel ? { pesel: pii.pesel } : {};
    case 'US':
      return pii.ssn ? { ssn: pii.ssn } : {};
    case 'SA':
      return pii.iqama ? { iqama: pii.iqama } : {};
    case 'AE':
      return pii.emiratesId ? { emiratesId: pii.emiratesId } : {};
    default:
      return {};
  }
}

/** PII hard-format gate. Emirates-ID checksum is advisory and intentionally excluded. */
function piiHardValid(countryCode: RegistryCountryCode, pii: PiiValues): boolean {
  if (countryCode === 'PL' && pii.pesel && !isValidPesel(pii.pesel)) return false;
  if (countryCode === 'US' && pii.ssn && !isValidSsn(pii.ssn)) return false;
  if (countryCode === 'SA' && pii.iqama && classifySaudiId(pii.iqama) === false) return false;
  if (countryCode === 'AE' && pii.emiratesId && !isValidEmiratesId(pii.emiratesId).formatValid) {
    return false;
  }
  return true;
}

/**
 * Wired employee registration section. Owns the form state, branches
 * loading/empty/error, and dispatches the per-market field set. All data access
 * flows through {@link useEmployeeCompliance} — this component never touches
 * tRPC directly (check:web-vite-data-layer).
 */
export function EmployeeComplianceSection() {
  const t = useTranslations('Employees.compliance');
  const fieldId = useId();
  const { can } = usePermissions();
  const { referenceListsQuery, referenceLists, register, registerMutation } =
    useEmployeeCompliance();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState<RegistryCountryCode | undefined>(undefined);
  const [countryFields, setCountryFields] = useState<Record<string, unknown>>({});
  const [pii, setPii] = useState<PiiValues>(EMPTY_PII);

  const canRegister = can('employee', ['create']);
  const canRevealPii = can('employeePii', ['read']);

  const handleCountryCodeChange = useCallback((code: RegistryCountryCode) => {
    setCountryCode(code);
    setCountryFields({});
    setPii(EMPTY_PII);
  }, []);

  const handleFieldChange = useCallback(
    (key: string, val: unknown) => setCountryFields(prev => ({ ...prev, [key]: val })),
    [],
  );
  const handlePiiChange = useCallback(
    (key: keyof PiiValues) => (val: string) => setPii(prev => ({ ...prev, [key]: val })),
    [],
  );
  const handleDisplayNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value),
    [],
  );
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
    [],
  );
  const handleRetry = useCallback(() => void referenceListsQuery.refetch(), [referenceListsQuery]);

  const renderCountryOption = useCallback(
    (code: RegistryCountryCode) => t(`countries.${code}`),
    [t],
  );

  const nfzOptions = useMemo(
    () =>
      (referenceLists?.nfzOddzialy ?? []).map(branch => ({
        value: branch.code,
        label: `${branch.code} — ${branch.name}`,
      })),
    [referenceLists],
  );

  const registered = registerMutation.data as RegisteredEmployee | undefined;
  const revealContexts = useMemo(() => {
    const build = (last4: string | null | undefined): PiiRevealContext | undefined =>
      registered && last4
        ? { workerId: registered.workerId, last4, canReveal: canRevealPii }
        : undefined;
    return {
      PL: build(registered?.peselLast4),
      US: build(registered?.ssnLast4),
      SA: build(registered?.iqamaLast4),
      AE: build(registered?.emiratesIdLast4),
    } as const;
  }, [registered, canRevealPii]);

  const cleanedFields = useMemo(() => stripEmpty(countryFields), [countryFields]);

  const missingCount = useMemo(() => {
    if (!countryCode) return 0;
    let missing = displayName.trim() ? 0 : 1;
    for (const key of REQUIRED_FIELDS[countryCode]) {
      if (!cleanedFields[key]) missing += 1;
    }
    if (
      countryCode === 'US' &&
      cleanedFields.stateWithholding === 'OTHER' &&
      !cleanedFields.stateOther
    ) {
      missing += 1;
    }
    return missing;
  }, [countryCode, displayName, cleanedFields]);

  const canSave = useMemo(() => {
    if (!countryCode || displayName.trim().length === 0) return false;
    const schema = employeeCountryFieldsSchemaMap[countryCode];
    const fieldsValid = schema ? schema.safeParse(cleanedFields).success : true;
    return fieldsValid && piiHardValid(countryCode, pii);
  }, [countryCode, displayName, cleanedFields, pii]);

  const handleRegister = useCallback(() => {
    if (!(countryCode && canSave)) return;
    register({
      displayName: displayName.trim(),
      email: email.trim() || undefined,
      countryCode,
      countryFields: cleanedFields,
      ...piiInputFor(countryCode, pii),
    });
  }, [countryCode, canSave, register, displayName, email, cleanedFields, pii]);

  if (referenceListsQuery.isLoading) {
    return <EmployeeComplianceLoadingCard />;
  }

  if (referenceListsQuery.isError) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6 text-center">
          <p role="alert" className="text-sm text-destructive">
            {t('loadError')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const countryLabel = countryCode ? t(`countries.${countryCode}`) : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          {countryCode ? t('cardTitle', { country: countryLabel }) : t('cardTitleGeneric')}
        </CardTitle>
        {countryCode && missingCount > 0 ? (
          <Badge variant="outline" className="border-warning/20 bg-warning/5 text-warning">
            <AlertCircle className="me-1 h-3 w-3" aria-hidden="true" />
            {t('incompleteFields', { count: missingCount })}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel htmlFor={`${fieldId}-name`} required>
              {t('displayNameLabel')}
            </RequiredLabel>
            <Input
              id={`${fieldId}-name`}
              aria-required="true"
              placeholder={t('displayNamePlaceholder')}
              value={displayName}
              onChange={handleDisplayNameChange}
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor={`${fieldId}-email`}>{t('emailLabel')}</RequiredLabel>
            <Input
              id={`${fieldId}-email`}
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={handleEmailChange}
            />
          </div>
        </div>

        <EntityTypeSelect<RegistryCountryCode>
          values={REGISTRY_COUNTRY_CODES}
          value={countryCode}
          onChange={handleCountryCodeChange}
          label={t('marketLabel')}
          required
          renderOption={renderCountryOption}
        />

        {countryCode ? (
          <EmployeeFieldsDispatch
            countryCode={countryCode}
            values={countryFields}
            onChange={handleFieldChange}
            pii={pii}
            onPiiChange={handlePiiChange}
            nfzOptions={nfzOptions}
            reveal={revealContexts}
          />
        ) : (
          <AdviserVerifyNote>{t('selectMarketPrompt')}</AdviserVerifyNote>
        )}

        {registered?.checksumAdvisory ? (
          <AdvisoryPill message={t('ae.emiratesIdChecksumAdvisory')} />
        ) : null}

        {canRegister ? (
          <Button
            type="button"
            onClick={handleRegister}
            disabled={!canSave || registerMutation.isPending}
            className="mt-4">
            {registerMutation.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="me-2 h-4 w-4" aria-hidden="true" />
            )}
            {t('registerButton')}
          </Button>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">{t('noRegisterPermission')}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface RevealContexts {
  PL?: PiiRevealContext;
  US?: PiiRevealContext;
  SA?: PiiRevealContext;
  AE?: PiiRevealContext;
}

function EmployeeFieldsDispatch({
  countryCode,
  values,
  onChange,
  pii,
  onPiiChange,
  nfzOptions,
  reveal,
}: {
  countryCode: RegistryCountryCode;
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  pii: PiiValues;
  onPiiChange: (key: keyof PiiValues) => (val: string) => void;
  nfzOptions: readonly { value: string; label: string }[];
  reveal: RevealContexts;
}) {
  switch (countryCode) {
    case 'PL':
      return (
        <PlEmployeeFields
          values={values}
          onChange={onChange}
          pesel={pii.pesel}
          onPeselChange={onPiiChange('pesel')}
          nfzOptions={nfzOptions}
          reveal={reveal.PL}
        />
      );
    case 'DE':
      return <DeEmployeeFields values={values} onChange={onChange} />;
    case 'GB':
      return <UkEmployeeFields values={values} onChange={onChange} />;
    case 'US':
      return (
        <UsEmployeeFields
          values={values}
          onChange={onChange}
          ssn={pii.ssn}
          onSsnChange={onPiiChange('ssn')}
          reveal={reveal.US}
        />
      );
    case 'AE':
      return (
        <AeEmployeeFields
          values={values}
          onChange={onChange}
          emiratesId={pii.emiratesId}
          onEmiratesIdChange={onPiiChange('emiratesId')}
          reveal={reveal.AE}
        />
      );
    case 'SA':
      return (
        <SaEmployeeFields
          values={values}
          onChange={onChange}
          iqama={pii.iqama}
          onIqamaChange={onPiiChange('iqama')}
          reveal={reveal.SA}
        />
      );
    default:
      return null;
  }
}
