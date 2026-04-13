'use client';

import type { DeCountryFields, UkCountryFields } from '@contractor-ops/validators';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';

import { DeComplianceFields } from './compliance/de-compliance-fields';
import { UkComplianceFields } from './compliance/uk-compliance-fields';

interface CountryComplianceSectionProps {
  contractorId: string;
}

export function CountryComplianceSection({ contractorId }: CountryComplianceSectionProps) {
  const configQuery = trpc.contractor.getCountryFieldsConfig.useQuery();
  const fieldsQuery = trpc.contractor.getCountryFields.useQuery({
    contractorId,
  });
  const updateMutation = trpc.contractor.updateCountryFields.useMutation({
    onSuccess: () => {
      toast.success('Compliance fields saved');
      void fieldsQuery.refetch();
    },
    onError: err => {
      toast.error(err.message || 'Failed to save compliance fields');
    },
  });

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
        {countryCode === 'AE' && (
          <UaeFields
            values={merged}
            onChange={(key, val) => setFormData(prev => ({ ...prev, [key]: val }))}
          />
        )}
        {countryCode === 'SA' && (
          <SaudiFields
            values={merged}
            onChange={(key, val) => setFormData(prev => ({ ...prev, [key]: val }))}
          />
        )}
        {countryCode === 'GB' && (
          <UkComplianceFields
            values={merged as Partial<UkCountryFields>}
            onChange={(key, val) => setFormData(prev => ({ ...prev, [key]: val }))}
          />
        )}
        {countryCode === 'DE' && (
          <DeComplianceFields
            values={merged as Partial<DeCountryFields>}
            onChange={(key, val) => setFormData(prev => ({ ...prev, [key]: val }))}
          />
        )}
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="mt-4">
          {updateMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="me-2 h-4 w-4" />
          )}
          Save Compliance Fields
        </Button>
      </CardContent>
    </Card>
  );
}

function UaeFields({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="freelancePermitNumber" className="text-sm font-medium">
          Freelance Permit Number
        </Label>
        <Input
          id="freelancePermitNumber"
          value={(values.freelancePermitNumber as string) ?? ''}
          onChange={e => onChange('freelancePermitNumber', e.target.value || undefined)}
          placeholder="Enter permit number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tradeLicenseNumber" className="text-sm font-medium">
          Trade License Number
        </Label>
        <Input
          id="tradeLicenseNumber"
          value={(values.tradeLicenseNumber as string) ?? ''}
          onChange={e => onChange('tradeLicenseNumber', e.target.value || undefined)}
          placeholder="Enter license number"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="freeZone"
          checked={(values.freeZone as boolean) ?? false}
          onCheckedChange={checked => onChange('freeZone', checked)}
        />
        <Label htmlFor="freeZone" className="text-sm font-medium">
          Free Zone
        </Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tradeLicenseExpiry" className="text-sm font-medium">
          Trade License Expiry
        </Label>
        <Input
          id="tradeLicenseExpiry"
          type="date"
          value={(values.tradeLicenseExpiry as string) ?? ''}
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
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="freelanceSaLicense" className="text-sm font-medium">
          Freelance.sa License
        </Label>
        <Input
          id="freelanceSaLicense"
          value={(values.freelanceSaLicense as string) ?? ''}
          onChange={e => onChange('freelanceSaLicense', e.target.value || undefined)}
          placeholder="Enter Freelance.sa license number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="commercialRegistration" className="text-sm font-medium">
          Commercial Registration
        </Label>
        <Input
          id="commercialRegistration"
          value={(values.commercialRegistration as string) ?? ''}
          onChange={e => onChange('commercialRegistration', e.target.value || undefined)}
          placeholder="Enter CR number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="commercialRegistrationExpiry" className="text-sm font-medium">
          CR Expiry Date
        </Label>
        <Input
          id="commercialRegistrationExpiry"
          type="date"
          value={(values.commercialRegistrationExpiry as string) ?? ''}
          onChange={e => onChange('commercialRegistrationExpiry', e.target.value || undefined)}
        />
      </div>
    </>
  );
}
