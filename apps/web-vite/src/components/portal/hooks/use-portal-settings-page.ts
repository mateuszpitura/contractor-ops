import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ProfileField } from '../profile-section.js';
import {
  usePortalProfile,
  usePortalSubmitFinancialChange,
  usePortalUpdateContactInfo,
} from './use-portal-settings.js';

export function usePortalSettingsPage() {
  const t = useTranslations('Portal');

  const profileQuery = usePortalProfile();
  const updateContactInfo = usePortalUpdateContactInfo();
  const submitFinancialChange = usePortalSubmitFinancialChange();

  const profile = profileQuery.data;

  const handleContactSave = useCallback(
    async (values: Record<string, string | null>) => {
      await updateContactInfo.mutateAsync({
        displayName: values.displayName ?? '',
        phone: values.phone || null,
        addressLine1: values.addressLine1 || null,
        addressLine2: values.addressLine2 || null,
        city: values.city || null,
        postalCode: values.postalCode || null,
        countryCode: values.countryCode || null,
      });
    },
    [updateContactInfo],
  );

  const handleFinancialSave = useCallback(
    async (values: Record<string, string | null>) => {
      await submitFinancialChange.mutateAsync({
        bankAccountNumber: values.bankAccountNumber || undefined,
        bankName: values.bankName || undefined,
        swiftBic: values.swiftBic || undefined,
        taxId: values.taxId || undefined,
      });
    },
    [submitFinancialChange],
  );

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

  return {
    isPending: profileQuery.isPending,
    personalFields,
    financialFields,
    pendingChangeRequest: profile?.pendingChangeRequest
      ? {
          id: profile.pendingChangeRequest.id,
          requestedChanges: profile.pendingChangeRequest.requestedChanges as Record<
            string,
            unknown
          >,
          createdAt: profile.pendingChangeRequest.createdAt,
        }
      : null,
    onContactSave: handleContactSave,
    onFinancialSave: handleFinancialSave,
  } as const;
}
