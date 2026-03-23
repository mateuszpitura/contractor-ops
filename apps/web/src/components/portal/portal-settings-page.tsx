"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ProfileSection } from "./profile-section";
import { NotificationPreferencesSection } from "./notification-preferences-section";

import type { ProfileField } from "./profile-section";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="mb-4 h-5 w-48" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal settings page with three collapsible sections:
 * 1. Personal Information (immediate save)
 * 2. Financial Details (approval flow)
 * 3. Notification Preferences (toggle switches)
 *
 * Per D-13, D-14, and UI-SPEC.
 */
export function PortalSettingsPage() {
  const queryClient = useQueryClient();

  // Fetch profile data
  const profileQuery = useQuery(trpc.portal.getProfile.queryOptions());

  // Mutations
  const updateContactInfo = useMutation(
    trpc.portal.updateContactInfo.mutationOptions(),
  );

  const submitFinancialChange = useMutation(
    trpc.portal.submitFinancialChangeRequest.mutationOptions(),
  );

  const profile = profileQuery.data;

  // Personal Information save handler
  const handleContactSave = async (
    values: Record<string, string | null>,
  ) => {
    await updateContactInfo.mutateAsync({
      displayName: values.displayName ?? "",
      phone: values.phone || null,
      addressLine1: values.addressLine1 || null,
      addressLine2: values.addressLine2 || null,
      city: values.city || null,
      postalCode: values.postalCode || null,
      countryCode: values.countryCode || null,
    });
    await queryClient.invalidateQueries({
      queryKey: trpc.portal.getProfile.queryOptions().queryKey,
    });
    toast.success("Profile updated");
  };

  // Financial Details save handler
  const handleFinancialSave = async (
    values: Record<string, string | null>,
  ) => {
    await submitFinancialChange.mutateAsync({
      bankAccountNumber: values.bankAccountNumber || undefined,
      bankName: values.bankName || undefined,
      swiftBic: values.swiftBic || undefined,
      taxId: values.taxId || undefined,
    });
    await queryClient.invalidateQueries({
      queryKey: trpc.portal.getProfile.queryOptions().queryKey,
    });
    toast.success("Change request submitted for approval");
  };

  // Build field configs
  const personalFields: ProfileField[] = profile
    ? [
        {
          key: "displayName",
          label: "Display Name",
          value: profile.displayName,
        },
        {
          key: "email",
          label: "Email Address",
          value: profile.email,
          readOnly: true,
          readOnlyCaption:
            "Contact your organization to change your email",
        },
        { key: "phone", label: "Phone Number", value: profile.phone },
        {
          key: "addressLine1",
          label: "Street Address",
          value: profile.addressLine1,
        },
        {
          key: "addressLine2",
          label: "Address Line 2",
          value: profile.addressLine2,
        },
        { key: "city", label: "City", value: profile.city },
        { key: "postalCode", label: "Postal Code", value: profile.postalCode },
        {
          key: "countryCode",
          label: "Country Code",
          value: profile.countryCode,
        },
      ]
    : [];

  const financialFields: ProfileField[] = profile
    ? [
        {
          key: "bankAccountNumber",
          label: "Bank Account Number",
          value: profile.billingProfile?.bankAccountMasked ?? null,
        },
        {
          key: "bankName",
          label: "Bank Name",
          value: profile.billingProfile?.bankName ?? null,
        },
        {
          key: "swiftBic",
          label: "SWIFT/BIC Code",
          value: profile.billingProfile?.swiftBic ?? null,
        },
        {
          key: "taxId",
          label: "Tax ID (NIP)",
          value: profile.billingProfile?.taxId ?? null,
        },
      ]
    : [];

  return (
    <div className="max-w-[640px]">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>

      {profileQuery.isPending ? (
        <SettingsSkeleton />
      ) : (
        <div className="space-y-4">
          {/* Personal Information */}
          <ProfileSection
            title="Personal Information"
            fields={personalFields}
            onSave={handleContactSave}
            defaultOpen
          />

          {/* Financial Details */}
          <ProfileSection
            title="Financial Details"
            fields={financialFields}
            requiresApproval
            onSave={handleFinancialSave}
            pendingChangeRequest={
              profile?.pendingChangeRequest
                ? {
                    id: profile.pendingChangeRequest.id,
                    requestedChanges:
                      profile.pendingChangeRequest.requestedChanges as Record<
                        string,
                        unknown
                      >,
                    createdAt: profile.pendingChangeRequest.createdAt,
                  }
                : null
            }
            defaultOpen
          />

          {/* Notification Preferences */}
          <NotificationPreferencesSection />
        </div>
      )}
    </div>
  );
}
