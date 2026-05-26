import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLateInterestCard(
  invoiceId: string,
  featureEnabled: boolean,
  contractorCountryCode: string,
  isBusinessCustomer: boolean,
  currency: string,
) {
  const t = useTranslations('Payments.lateInterest');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isApplicable =
    featureEnabled && contractorCountryCode === 'GB' && isBusinessCustomer && currency === 'GBP';

  const query = useQuery(
    trpc.latePaymentInterest.getForInvoice.queryOptions({ invoiceId }, { enabled: isApplicable }),
  );

  const [isDownloadClaimPending, setIsDownloadClaimPending] = useState(false);

  const onDownloadClaim = useCallback(
    async (claimId: string) => {
      setIsDownloadClaimPending(true);
      try {
        const result = await queryClient.fetchQuery(
          trpc.latePaymentInterest.downloadClaim.queryOptions({ claimId }),
        );
        if (result.pdfStatus !== 'READY' || !result.downloadUrl) {
          toast.error(result.pdfError ?? t('downloadClaimNotReady'));
          return;
        }
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('downloadClaimError'));
      } finally {
        setIsDownloadClaimPending(false);
      }
    },
    [queryClient, t, trpc.latePaymentInterest.downloadClaim],
  );

  return {
    isApplicable,
    isLoading: query.isLoading,
    isError: query.isError,
    data: query.data,
    onDownloadClaim,
    isDownloadClaimPending,
  } as const;
}
