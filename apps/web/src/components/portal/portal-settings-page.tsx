'use client';

import { Card } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { portalTrpc } from '@/trpc/init';
import { NotificationPreferencesSection } from './notification-preferences-section';
import type { ProfileField } from './profile-section';
import { ProfileSection } from './profile-section';

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

/**
 * Loading skeleton matching the final ProfileSection layout:
 * collapsible Card with chevron + title header, plus a stack of
 * label/value rows that mirror the populated view mode.
 */
function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <Card key={`skel-${i}`}>
          {/* Header row mirrors CollapsibleTrigger button (chevron + title + optional trailing badge/edit) */}
          <div className="flex min-h-[48px] items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-40" />
            <div className="ms-auto">
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          {/* Body: label + value rows */}
          <div className="space-y-3 border-t px-4 py-4">
            {Array.from({ length: 4 }).map((__, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <div key={`field-${j}`} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ))}
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
  const t = useTranslations('Portal');
  const queryClient = useQueryClient();

  // Fetch profile data
  const profileQuery = useQuery(portalTrpc.portal.getProfile.queryOptions());

  // Mutations
  const updateContactInfo = useMutation(
    portalTrpc.portal.updateContactInfo.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('toast.saved'));
        queryClient.invalidateQueries(portalTrpc.portal.pathFilter());
      },
    }),
  );

  const submitFinancialChange = useMutation(
    portalTrpc.portal.submitFinancialChangeRequest.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('toast.saved'));
        queryClient.invalidateQueries(portalTrpc.portal.pathFilter());
      },
    }),
  );

  const profile = profileQuery.data;

  // Personal Information save handler
  const handleContactSave = async (values: Record<string, string | null>) => {
    await updateContactInfo.mutateAsync({
      displayName: values.displayName ?? '',
      phone: values.phone || null,
      addressLine1: values.addressLine1 || null,
      addressLine2: values.addressLine2 || null,
      city: values.city || null,
      postalCode: values.postalCode || null,
      countryCode: values.countryCode || null,
    });
    await queryClient.invalidateQueries({
      queryKey: portalTrpc.portal.getProfile.queryOptions().queryKey,
    });
    toast.success(t('settings.profileUpdated'));
  };

  // Financial Details save handler
  const handleFinancialSave = async (values: Record<string, string | null>) => {
    await submitFinancialChange.mutateAsync({
      bankAccountNumber: values.bankAccountNumber || undefined,
      bankName: values.bankName || undefined,
      swiftBic: values.swiftBic || undefined,
      taxId: values.taxId || undefined,
    });
    await queryClient.invalidateQueries({
      queryKey: portalTrpc.portal.getProfile.queryOptions().queryKey,
    });
    toast.success(t('settings.changeRequestSubmitted'));
  };

  // Build field configs
  const personalFields: ProfileField[] = profile
    ? [
        {
          key: 'displayName',
          label: t('settings.fields.displayName'),
          value: profile.displayName,
        },
        {
          key: 'email',
          label: t('settings.fields.emailAddress'),
          value: profile.email,
          readOnly: true,
          readOnlyCaption: t('settings.fields.emailReadOnly'),
        },
        { key: 'phone', label: t('settings.fields.phoneNumber'), value: profile.phone },
        {
          key: 'addressLine1',
          label: t('settings.fields.streetAddress'),
          value: profile.addressLine1,
        },
        {
          key: 'addressLine2',
          label: t('settings.fields.addressLine2'),
          value: profile.addressLine2,
        },
        { key: 'city', label: t('settings.fields.city'), value: profile.city },
        { key: 'postalCode', label: t('settings.fields.postalCode'), value: profile.postalCode },
        {
          key: 'countryCode',
          label: t('settings.fields.countryCode'),
          value: profile.countryCode,
        },
      ]
    : [];

  const financialFields: ProfileField[] = profile
    ? [
        {
          key: 'bankAccountNumber',
          label: t('settings.fields.bankAccountNumber'),
          value: profile.billingProfile?.bankAccountMasked ?? null,
        },
        {
          key: 'bankName',
          label: t('settings.fields.bankName'),
          value: profile.billingProfile?.bankName ?? null,
        },
        {
          key: 'swiftBic',
          label: t('settings.fields.swiftBic'),
          value: profile.billingProfile?.swiftBic ?? null,
        },
        {
          key: 'taxId',
          label: t('settings.fields.taxId'),
          value: profile.billingProfile?.taxId ?? null,
        },
      ]
    : [];

  return (
    <div className="max-w-[640px]">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {profileQuery.isPending ? (
        <SettingsSkeleton />
      ) : (
        <div className="space-y-4">
          {/* Personal Information */}
          <ProfileSection
            title={t('settings.personalInfo')}
            fields={personalFields}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onSave={handleContactSave}
            defaultOpen
          />

          {/* Financial Details */}
          <ProfileSection
            title={t('settings.financialDetails')}
            fields={financialFields}
            requiresApproval
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onSave={handleFinancialSave}
            pendingChangeRequest={
              profile?.pendingChangeRequest
                ? {
                    id: profile.pendingChangeRequest.id,
                    requestedChanges: profile.pendingChangeRequest.requestedChanges as Record<
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
