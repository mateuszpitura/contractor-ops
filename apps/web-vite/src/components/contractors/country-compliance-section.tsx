import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import type { DeCountryFields, UkCountryFields, UsCountryFields } from '@contractor-ops/validators';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useId, useMemo } from 'react';

import { usePermissions } from '../../hooks/use-permissions.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { ClassificationTileContainer } from './classification/classification-tile-container.js';
import { DeComplianceFields } from './compliance/de-compliance-fields.js';
import { UkComplianceFields } from './compliance/uk-compliance-fields.js';
import { UsComplianceFields } from './compliance/us-compliance-fields.js';
import { FreeZoneAssignmentContainer } from './free-zone/free-zone-assignment-container.js';
import type {
  useContractorEngagements,
  useCountryCompliance,
} from './hooks/use-country-compliance.js';
import { RevalidateVatButtonContainer } from './revalidate-vat-button-container.js';
import { VatValidationStatusPill } from './vat-validation-status-pill.js';

export interface CountryComplianceSectionViewProps {
  contractorId: string;
  compliance: ReturnType<typeof useCountryCompliance>;
  engagements: ReturnType<typeof useContractorEngagements>;
  formData: Record<string, unknown>;
  onFormDataChange: Dispatch<SetStateAction<Record<string, unknown>>>;
}

type EngagementWithClassificationContext = {
  id: string;
  contractor?: {
    countryCode?: string | null;
    displayName?: string | null;
  } | null;
  project?: {
    name?: string | null;
  } | null;
};

export function CountryComplianceLoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export function CountryComplianceSectionView({
  contractorId,
  compliance,
  engagements,
  formData,
  onFormDataChange,
}: CountryComplianceSectionViewProps) {
  const t = useTranslations('Contractors.countryCompliance');
  const { can } = usePermissions();
  const { configQuery, fieldsQuery, contractorQuery, updateMutation, saveFields, isLoading } =
    compliance;

  const handleFieldChange = useCallback(
    (key: string, val: unknown) => onFormDataChange(prev => ({ ...prev, [key]: val })),
    [onFormDataChange],
  );

  const countryCode = configQuery.data?.countryCode;
  const fieldsData = fieldsQuery.data;
  const merged = useMemo(
    () => ({ ...((fieldsData ?? {}) as Record<string, unknown>), ...formData }),
    [fieldsData, formData],
  );

  const handleSave = useCallback(() => {
    if (!countryCode) return;
    saveFields(countryCode, merged);
  }, [countryCode, saveFields, merged]);

  // Lifted to CountryComplianceSectionContainer; retained here as a defensive
  // guard for direct view usage (tests + legacy callers). Container is the
  // single source of variant decisions; this branch should not fire in prod.
  if (isLoading) {
    return <CountryComplianceLoadingCard />;
  }

  if (!configQuery.data?.hasCountryFields) {
    return null;
  }

  if (!countryCode) return null;

  const COUNTRY_LABELS: Record<string, string> = {
    AE: t('countries.AE'),
    SA: t('countries.SA'),
    GB: t('countries.GB'),
    DE: t('countries.DE'),
    US: t('countries.US'),
  };
  const countryLabel = COUNTRY_LABELS[countryCode] ?? countryCode;

  const missingCount = configQuery.data.fields
    ? configQuery.data.fields.filter((f: string) => !merged[f]).length
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          {t('cardTitle', { country: countryLabel })}
        </CardTitle>
        {missingCount > 0 && (
          <Badge variant="outline" className="border-warning/20 bg-warning/5 text-warning">
            <AlertCircle className="me-1 h-3 w-3" />
            {t('incompleteFields', { count: missingCount })}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <CountryFieldsDispatch
          countryCode={countryCode}
          contractorId={contractorId}
          values={merged}
          onChange={handleFieldChange}
          ssnLast4={(contractorQuery.data as { ssnLast4?: string | null } | undefined)?.ssnLast4}
          canRevealSsn={can('contractorPii', ['read'])}
          uspsVerified={
            (contractorQuery.data as { uspsVerified?: boolean | null } | undefined)?.uspsVerified
          }
        />
        {(countryCode === 'GB' || countryCode === 'DE') && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3"
            data-testid="vat-validation-section">
            <Label className="text-sm font-medium">{t('vatValidationLabel')}</Label>
            <VatValidationStatusPill
              status={
                (contractorQuery.data?.latestVatValidationStatus ?? null) as
                  | 'valid'
                  | 'invalid'
                  | 'stale'
                  | 'unavailable'
                  | null
              }
              validatedAt={contractorQuery.data?.latestVatValidatedAt ?? null}
            />
            <RevalidateVatButtonContainer contractorId={contractorId} />
          </div>
        )}
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="mt-4">
          {updateMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="me-2 h-4 w-4" />
          )}
          {t('saveButton')}
        </Button>

        <ClassificationEngagementsBlock contractorId={contractorId} engagements={engagements} />
      </CardContent>
    </Card>
  );
}

function ClassificationEngagementsBlock({
  contractorId,
  engagements: engagementsState,
}: {
  contractorId: string;
  engagements: ReturnType<typeof useContractorEngagements>;
}) {
  const t = useTranslations('Contractors.countryCompliance');
  const { isLoading, engagements } = engagementsState;

  if (isLoading) {
    return (
      <div
        data-testid="classification-engagements-loading"
        className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        <span>{t('loadingEngagements')}</span>
      </div>
    );
  }

  const eligible = (engagements as EngagementWithClassificationContext[]).filter(e => {
    const cc = e.contractor?.countryCode?.toUpperCase();
    return cc === 'GB' || cc === 'DE';
  });

  if (eligible.length === 0) return null;

  return (
    <section
      data-testid="classification-section"
      aria-label={t('classificationHeading')}
      className="mt-6 space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">{t('classificationHeading')}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {eligible.map(engagement => {
          const cc = engagement.contractor?.countryCode?.toUpperCase();
          const countryCode = cc === 'GB' ? 'GB' : 'DE';
          const projectName = engagement.project?.name ?? t('defaultEngagementName');
          const contractorDisplay = engagement.contractor?.displayName ?? projectName;
          return (
            <ClassificationTileContainer
              key={engagement.id}
              engagement={{
                id: engagement.id,
                name: `${contractorDisplay} — ${projectName}`,
                contractorId,
                countryCode,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function CountryFieldsDispatch({
  countryCode,
  contractorId,
  values,
  onChange,
  ssnLast4,
  canRevealSsn,
  uspsVerified,
}: {
  countryCode: string;
  contractorId: string;
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  ssnLast4?: string | null;
  canRevealSsn?: boolean;
  uspsVerified?: boolean | null;
}) {
  switch (countryCode) {
    case 'AE':
      return <UaeFields contractorId={contractorId} values={values} onChange={onChange} />;
    case 'SA':
      return <SaudiFields values={values} onChange={onChange} />;
    case 'GB':
      return <UkComplianceFields values={values as Partial<UkCountryFields>} onChange={onChange} />;
    case 'DE':
      return <DeComplianceFields values={values as Partial<DeCountryFields>} onChange={onChange} />;
    case 'US':
      return (
        <UsComplianceFields
          contractorId={contractorId}
          values={values as Partial<UsCountryFields>}
          onChange={onChange}
          ssnLast4={ssnLast4 ?? undefined}
          canRevealSsn={canRevealSsn ?? false}
          uspsStatus={
            uspsVerified == null ? 'not-validated' : uspsVerified ? 'verified' : 'unverified'
          }
        />
      );
    default:
      return null;
  }
}

function UaeFields({
  contractorId,
  values,
  onChange,
}: {
  contractorId: string;
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  const tUae = useTranslations('Contractors.countryCompliance.uae');
  const id = useId();

  const handlePermitChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange('freelancePermitNumber', e.target.value || undefined),
    [onChange],
  );

  // D-02: the freeform trade-license number / free-zone switch / expiry inputs are
  // superseded by the structured FreeZoneAssignment surface below. Only the
  // freelance-permit field remains in country-fields (server trimmed the AE config
  // to ['freelancePermitNumber'] in Plan 05). The free zone, license number/category,
  // expiry tracking and permitted activities are now recorded in the dedicated form.
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-freelancePermitNumber`} className="text-sm font-medium">
          {tUae('freelancePermitNumberLabel')}
        </Label>
        <Input
          id={`${id}-freelancePermitNumber`}
          value={(values.freelancePermitNumber as string) ?? ''}
          onChange={handlePermitChange}
          placeholder={tUae('freelancePermitNumberPlaceholder')}
        />
      </div>
      <FreeZoneAssignmentContainer contractorId={contractorId} />
    </>
  );
}

function SaudiFields({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  const tSaudi = useTranslations('Contractors.countryCompliance.saudi');
  const id = useId();

  const handleLicenseChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange('freelanceSaLicense', e.target.value || undefined),
    [onChange],
  );
  const handleCommercialRegChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange('commercialRegistration', e.target.value || undefined),
    [onChange],
  );
  const handleCrExpiryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange('commercialRegistrationExpiry', e.target.value || undefined),
    [onChange],
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-freelanceSaLicense`} className="text-sm font-medium">
          {tSaudi('freelanceSaLicenseLabel')}
        </Label>
        <Input
          id={`${id}-freelanceSaLicense`}
          value={(values.freelanceSaLicense as string) ?? ''}
          onChange={handleLicenseChange}
          placeholder={tSaudi('freelanceSaLicensePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-commercialRegistration`} className="text-sm font-medium">
          {tSaudi('commercialRegistrationLabel')}
        </Label>
        <Input
          id={`${id}-commercialRegistration`}
          value={(values.commercialRegistration as string) ?? ''}
          onChange={handleCommercialRegChange}
          placeholder={tSaudi('commercialRegistrationPlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-commercialRegistrationExpiry`} className="text-sm font-medium">
          {tSaudi('crExpiryLabel')}
        </Label>
        <Input
          id={`${id}-commercialRegistrationExpiry`}
          type="date"
          value={(values.commercialRegistrationExpiry as string) ?? ''}
          onChange={handleCrExpiryChange}
        />
      </div>
    </>
  );
}
