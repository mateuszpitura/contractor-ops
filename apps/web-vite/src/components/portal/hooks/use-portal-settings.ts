import { useMutation, useQuery } from '@tanstack/react-query';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC, useTRPC } from '../../../providers/trpc-provider.js';

export function usePortalEquipmentList() {
  const trpc = usePortalTRPC();
  return useQuery(trpc.portal.listEquipment.queryOptions());
}

export function usePortalPendingSignatures() {
  const trpc = useTRPC();
  return useQuery(trpc.esign.listPendingForContractor.queryOptions());
}

export function usePortalSigningUrl(
  input: { envelopeId: string; recipientEmail: string; returnUrl: string },
  options: { enabled: boolean; usePortalAuth?: boolean },
) {
  const trpc = useTRPC();
  const queryEnabled = { enabled: options.enabled };

  return useQuery(
    options.usePortalAuth
      ? trpc.esign.getPortalSigningUrl.queryOptions(input, queryEnabled)
      : trpc.esign.getSigningUrl.queryOptions(input, queryEnabled),
  );
}

export function usePortalProfile() {
  const trpc = usePortalTRPC();
  return useQuery(trpc.portal.getProfile.queryOptions());
}

export function usePortalUpdateContactInfo() {
  const t = useTranslations('Portal');
  const trpc = usePortalTRPC();

  return useResourceMutation(trpc.portal.updateContactInfo.mutationOptions(), {
    successMessage: t('toast.saved'),
    invalidate: [{ queryKey: trpc.portal.getProfile.queryOptions().queryKey }],
  });
}

export function usePortalSubmitFinancialChange() {
  const t = useTranslations('Portal');
  const trpc = usePortalTRPC();

  return useResourceMutation(trpc.portal.submitFinancialChangeRequest.mutationOptions(), {
    successMessage: t('toast.saved'),
    invalidate: [{ queryKey: trpc.portal.getProfile.queryOptions().queryKey }],
  });
}

export function usePortalNotificationPreferences() {
  const trpc = usePortalTRPC();
  return useQuery(trpc.portal.getNotificationPreferences.queryOptions());
}

export function usePortalUpdateNotificationPreference() {
  const t = useTranslations('Portal.notificationPreferences');
  const trpc = usePortalTRPC();

  return useResourceMutation(trpc.portal.updateNotificationPreference.mutationOptions(), {
    invalidate: [trpc.portal.getNotificationPreferences.queryKey()],
    successMessage: t('toast.updated'),
    errorMessage: t('errors.updateFailed'),
  });
}

export function usePortalLogout() {
  const trpc = usePortalTRPC();
  return useMutation(trpc.portal.logout.mutationOptions());
}
