"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface CountryComplianceSectionProps {
  contractorId: string;
  orgCountryCode: string | null;
  initialFields: Record<string, unknown> | null;
}

export function CountryComplianceSection({
  contractorId,
  orgCountryCode,
  initialFields,
}: CountryComplianceSectionProps) {
  const [values, setValues] = useState<Record<string, unknown>>(
    (initialFields as Record<string, unknown>) ?? {}
  );

  // Only show for supported countries
  if (!orgCountryCode || !["AE", "SA"].includes(orgCountryCode)) {
    return null;
  }

  const updateMutation = api.contractor.updateCountryFields.useMutation({
    onSuccess: () => {
      toast.success("Compliance fields saved");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save compliance fields");
    },
  });

  function onChange(key: string, val: unknown) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    updateMutation.mutate({
      contractorId,
      countryFields: values,
    });
  }

  const countryLabel = orgCountryCode === "AE" ? "UAE" : "Saudi Arabia";

  // Count missing fields
  const requiredKeys = orgCountryCode === "AE"
    ? ["freelancePermitNumber", "tradeLicenseNumber"]
    : ["freelanceSaLicense", "commercialRegistration"];
  const missingCount = requiredKeys.filter((k) => !values[k]).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          Country Compliance &mdash; {countryLabel}
        </CardTitle>
        {missingCount > 0 && (
          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-600">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {missingCount} missing
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {orgCountryCode === "AE" && (
          <UaeFields values={values} onChange={onChange} />
        )}
        {orgCountryCode === "SA" && (
          <SaudiFields values={values} onChange={onChange} />
        )}

        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
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
          value={(values.freelancePermitNumber as string) ?? ""}
          onChange={(e) => onChange("freelancePermitNumber", e.target.value || undefined)}
          placeholder="Enter permit number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tradeLicenseNumber" className="text-sm font-medium">
          Trade License Number
        </Label>
        <Input
          id="tradeLicenseNumber"
          value={(values.tradeLicenseNumber as string) ?? ""}
          onChange={(e) => onChange("tradeLicenseNumber", e.target.value || undefined)}
          placeholder="Enter license number"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="freeZone"
          checked={(values.freeZone as boolean) ?? false}
          onCheckedChange={(checked) => onChange("freeZone", checked)}
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
          value={(values.tradeLicenseExpiry as string) ?? ""}
          onChange={(e) => onChange("tradeLicenseExpiry", e.target.value || undefined)}
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
          value={(values.freelanceSaLicense as string) ?? ""}
          onChange={(e) => onChange("freelanceSaLicense", e.target.value || undefined)}
          placeholder="Enter Freelance.sa license number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="commercialRegistration" className="text-sm font-medium">
          Commercial Registration
        </Label>
        <Input
          id="commercialRegistration"
          value={(values.commercialRegistration as string) ?? ""}
          onChange={(e) => onChange("commercialRegistration", e.target.value || undefined)}
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
          value={(values.commercialRegistrationExpiry as string) ?? ""}
          onChange={(e) => onChange("commercialRegistrationExpiry", e.target.value || undefined)}
        />
      </div>
    </>
  );
}
