import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();

  return useMutation(
    trpc.portal.updateContactInfo.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('toast.saved'));
        void queryClient.invalidateQueries({
          queryKey: trpc.portal.getProfile.queryOptions().queryKey,
        });
      },
    }),
  );
}

export function usePortalSubmitFinancialChange() {
  const t = useTranslations('Portal');
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.portal.submitFinancialChangeRequest.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success(t('toast.saved'));
        void queryClient.invalidateQueries({
          queryKey: trpc.portal.getProfile.queryOptions().queryKey,
        });
      },
    }),
  );
}

export function usePortalNotificationPreferences() {
  const trpc = usePortalTRPC();
  return useQuery(trpc.portal.getNotificationPreferences.queryOptions());
}

export function usePortalUpdateNotificationPreference() {
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.portal.updateNotificationPreference.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.portal.getNotificationPreferences.queryKey(),
      });
    },
  });
}

export function usePortalLogout() {
  const trpc = usePortalTRPC();
  return useMutation(trpc.portal.logout.mutationOptions());
}
