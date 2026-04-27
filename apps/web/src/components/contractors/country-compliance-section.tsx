'use client';

import type { DeCountryFields, UkCountryFields } from '@contractor-ops/validators';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';

import { ClassificationTile } from './classification/classification-tile';
import { DeComplianceFields } from './compliance/de-compliance-fields';
import { UkComplianceFields } from './compliance/uk-compliance-fields';
import { RevalidateVatButton } from './revalidate-vat-button';
import { VatValidationStatusPill } from './vat-validation-status-pill';

interface CountryComplianceSectionProps {
  contractorId: string;
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

export function CountryComplianceSection({ contractorId }: CountryComplianceSectionProps) {
  const configQuery = useQuery(trpc.contractor.getCountryFieldsConfig.queryOptions());
  const fieldsQuery = useQuery(trpc.contractor.getCountryFields.queryOptions({ contractorId }));
  // Phase 57 · Plan 04 — surface latest HMRC/VIES validation state for GB/DE orgs.
  const contractorQuery = useQuery(trpc.contractor.getById.queryOptions({ id: contractorId }));
  const updateMutation = useMutation(
    trpc.contractor.updateCountryFields.mutationOptions({
      onSuccess: () => {
        toast.success('Compliance fields saved');
        void fieldsQuery.refetch();
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || 'Failed to save compliance fields');
      },
    }),
  );

  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Don't render if org has no country fields
  if (configQuery.isLoading || fieldsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!configQuery.data?.hasCountryFields) {
    return null; // No country-specific fields for this org
  }

  const { countryCode } = configQuery.data;
  if (!countryCode) return null; // No country code — nothing to render
  const existingFields = (fieldsQuery.data ?? {}) as Record<string, unknown>;
  const merged = { ...existingFields, ...formData };

  const COUNTRY_LABELS: Record<string, string> = {
    AE: 'UAE',
    SA: 'Saudi Arabia',
    GB: 'United Kingdom',
    DE: 'Deutschland',
  };
  const countryLabel = COUNTRY_LABELS[countryCode] ?? countryCode;

  function handleSave() {
    if (!countryCode) return;
    updateMutation.mutate({
      contractorId,
      countryCode,
      fields: merged,
    });
  }

  const missingCount = configQuery.data.fields
    ? configQuery.data.fields.filter((f: string) => !merged[f]).length
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          Country Compliance &mdash; {countryLabel}
        </CardTitle>
        {missingCount > 0 && (
          <Badge variant="outline" className="border-warning/20 bg-warning/5 text-warning">
            <AlertCircle className="me-1 h-3 w-3" />
            {missingCount} incomplete
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <CountryFieldsDispatch
          countryCode={countryCode}
          values={merged}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={(key, val) => setFormData(prev => ({ ...prev, [key]: val }))}
        />
        {(countryCode === 'GB' || countryCode === 'DE') && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3"
            data-testid="vat-validation-section">
            <Label className="text-sm font-medium">VAT validation</Label>
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
            <RevalidateVatButton contractorId={contractorId} />
          </div>
        )}
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="mt-4">
          {updateMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="me-2 h-4 w-4" />
          )}
          Save Compliance Fields
        </Button>

        {/* Phase 58 addition — per-engagement classification per CLASS-11. */}
        <ClassificationEngagementsBlock contractorId={contractorId} />
      </CardContent>
    </Card>
  );
}

/**
 * Dispatch one ClassificationTile per engagement whose contractor.countryCode
 * is GB or DE. Non-GB/DE engagements render nothing; contractors with zero
 * GB/DE engagements render nothing (no dead section). Keeps the Phase 56
 * CountryComplianceSection shape untouched — this is an appended block.
 */
function ClassificationEngagementsBlock({ contractorId }: { contractorId: string }) {
  const engagementsQuery = useQuery(trpc.contractor.listEngagements.queryOptions({ contractorId }));

  if (engagementsQuery.isLoading) {
    return (
      <div
        data-testid="classification-engagements-loading"
        className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        <span>Loading engagements…</span>
      </div>
    );
  }

  const engagements = (engagementsQuery.data ?? []) as EngagementWithClassificationContext[];
  const eligible = engagements.filter(e => {
    const cc = e.contractor?.countryCode?.toUpperCase();
    return cc === 'GB' || cc === 'DE';
  });

  if (eligible.length === 0) return null;

  return (
    <section
      data-testid="classification-section"
      aria-label="Classification"
      className="mt-6 space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Classification</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {eligible.map(engagement => {
          const cc = engagement.contractor?.countryCode?.toUpperCase();
          const countryCode = cc === 'GB' ? 'GB' : 'DE';
          const projectName = engagement.project?.name ?? 'Engagement';
          const contractorDisplay = engagement.contractor?.displayName ?? projectName;
          return (
            <ClassificationTile
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
  values,
  onChange,
}: {
  countryCode: string;
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  switch (countryCode) {
    case 'AE':
      return <UaeFields values={values} onChange={onChange} />;
    case 'SA':
      return <SaudiFields values={values} onChange={onChange} />;
    case 'GB':
      return <UkComplianceFields values={values as Partial<UkCountryFields>} onChange={onChange} />;
    case 'DE':
      return <DeComplianceFields values={values as Partial<DeCountryFields>} onChange={onChange} />;
    default:
      return null;
  }
}

function UaeFields({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  const id = useId();
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-freelancePermitNumber`} className="text-sm font-medium">
          Freelance Permit Number
        </Label>
        <Input
          id={`${id}-freelancePermitNumber`}
          value={(values.freelancePermitNumber as string) ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => onChange('freelancePermitNumber', e.target.value || undefined)}
          placeholder="Enter permit number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-tradeLicenseNumber`} className="text-sm font-medium">
          Trade License Number
        </Label>
        <Input
          id={`${id}-tradeLicenseNumber`}
          value={(values.tradeLicenseNumber as string) ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => onChange('tradeLicenseNumber', e.target.value || undefined)}
          placeholder="Enter license number"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`${id}-freeZone`}
          checked={(values.freeZone as boolean) ?? false}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onCheckedChange={checked => onChange('freeZone', checked)}
        />
        <Label htmlFor={`${id}-freeZone`} className="text-sm font-medium">
          Free Zone
        </Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-tradeLicenseExpiry`} className="text-sm font-medium">
          Trade License Expiry
        </Label>
        <Input
          id={`${id}-tradeLicenseExpiry`}
          type="date"
          value={(values.tradeLicenseExpiry as string) ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => onChange('tradeLicenseExpiry', e.target.value || undefined)}
        />
      </div>
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
  const id = useId();
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-freelanceSaLicense`} className="text-sm font-medium">
          Freelance.sa License
        </Label>
        <Input
          id={`${id}-freelanceSaLicense`}
          value={(values.freelanceSaLicense as string) ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => onChange('freelanceSaLicense', e.target.value || undefined)}
          placeholder="Enter Freelance.sa license number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-commercialRegistration`} className="text-sm font-medium">
          Commercial Registration
        </Label>
        <Input
          id={`${id}-commercialRegistration`}
          value={(values.commercialRegistration as string) ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => onChange('commercialRegistration', e.target.value || undefined)}
          placeholder="Enter CR number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-commercialRegistrationExpiry`} className="text-sm font-medium">
          CR Expiry Date
        </Label>
        <Input
          id={`${id}-commercialRegistrationExpiry`}
          type="date"
          value={(values.commercialRegistrationExpiry as string) ?? ''}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => onChange('commercialRegistrationExpiry', e.target.value || undefined)}
        />
      </div>
    </>
  );
}
