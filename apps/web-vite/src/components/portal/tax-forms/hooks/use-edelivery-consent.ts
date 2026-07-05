import { useMutation, useQuery } from '@tanstack/react-query';

import { usePortalTRPC } from '../../../../providers/trpc-provider.js';

export interface EdeliveryConsentState {
  consented: boolean;
  consentedAt: string | Date | null;
}

export interface CopyBDownloadResult {
  consented: boolean;
  paperCopy?: boolean;
  signedUrl?: string;
  expiresInSeconds?: number;
}

/**
 * The SOLE tRPC boundary for the portal IRS electronic-delivery consent + Copy-B
 * download. The consent timestamp / IP / actor identity are 100% server-derived
 * (the mutation inputs carry none of them) — the client cannot forge the
 * attestation. The step + download components stay presentational.
 */
export function useEdeliveryConsent(taxYear: number) {
  const trpc = usePortalTRPC();

  const consentQuery = useQuery(trpc.portal.getEdeliveryConsent.queryOptions());
  const recordMutation = useMutation(trpc.portal.recordEdeliveryConsent.mutationOptions());
  const withdrawMutation = useMutation(trpc.portal.withdrawConsent.mutationOptions());
  const downloadMutation = useMutation(trpc.portal.downloadCopyB.mutationOptions());

  const consent = (consentQuery.data ?? null) as EdeliveryConsentState | null;

  return {
    isPending: consentQuery.isPending,
    error: consentQuery.error ?? null,
    consented: consent?.consented ?? false,
    consentedAt: consent?.consentedAt ?? null,

    recordConsent: async () => {
      await recordMutation.mutateAsync({});
      await consentQuery.refetch();
    },
    isRecording: recordMutation.isPending,

    withdraw: async () => {
      await withdrawMutation.mutateAsync({});
      await consentQuery.refetch();
    },
    isWithdrawing: withdrawMutation.isPending,

    downloadCopyB: () => downloadMutation.mutateAsync({ taxYear }) as Promise<CopyBDownloadResult>,
    isDownloading: downloadMutation.isPending,
    downloadError: downloadMutation.error ?? null,

    refetch: () => {
      void consentQuery.refetch();
    },
  } as const;
}
