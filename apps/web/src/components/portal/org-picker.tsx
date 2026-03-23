"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgInfo {
  contractorId: string;
  organizationId: string;
  orgName: string;
  orgLogo?: string | null;
}

interface OrgPickerProps {
  orgs: OrgInfo[];
  email: string;
  onSelect: (contractorId: string, organizationId: string) => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Organization picker for multi-org contractors.
 * Shown after magic link verification when a contractor has 2+ org associations.
 *
 * Per UI-SPEC D-15:
 * - Centered layout max-w-[480px]
 * - Card per org with logo + name
 * - Hover accent border, loading spinner on selected card
 */
export function OrgPicker({ orgs, email, onSelect, loading }: OrgPickerProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const handleSelect = (org: OrgInfo) => {
    if (loading) return;
    setSelectedOrgId(org.organizationId);
    onSelect(org.contractorId, org.organizationId);
  };

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold">Select Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You work with multiple organizations. Choose one to continue.
        </p>
      </div>

      <div className="space-y-3">
        {orgs.map((org) => {
          const isSelected = selectedOrgId === org.organizationId;
          const isDisabled = loading && !isSelected;

          return (
            <Card
              key={org.organizationId}
              className={cn(
                "cursor-pointer transition-colors",
                isSelected && loading
                  ? "border-primary"
                  : "hover:border-primary",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !isDisabled && handleSelect(org)}
              role="button"
              tabIndex={0}
              aria-label={`Select ${org.orgName}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!isDisabled) handleSelect(org);
                }
              }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                {org.orgLogo ? (
                  <img
                    src={org.orgLogo}
                    alt={org.orgName}
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
                    {org.orgName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold">{org.orgName}</span>
                {isSelected && loading && (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Signed in as {email}
      </p>
    </div>
  );
}
