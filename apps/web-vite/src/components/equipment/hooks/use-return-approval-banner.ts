/**
 * Data hook for the return-approval banner — approve/reject mutations.
 * Ported alongside `return-approval-banner.tsx` from legacy apps/web
 * (commit 62a97d73). Pulled out to satisfy
 * `scripts/check-web-vite-data-layer.mjs`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useReturnApprovalBanner() {
  const t = useTranslations('Equipment.return');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: trpc.equipment.getById.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.equipment.listReturnRequests.queryKey(),
    });
  };

  const approve = useMutation(
    trpc.equipment.approveReturnRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvedToast'));
        invalidate();
      },
      onError: () => toast.error(t('actionFailed')),
    }),
  );

  const reject = useMutation(
    trpc.equipment.rejectReturnRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('rejectedToast'));
        invalidate();
      },
      onError: () => toast.error(t('actionFailed')),
    }),
  );

  return {
    approve: (id: string) => approve.mutate({ id, parcelSize: 'large' }),
    reject: (id: string) => reject.mutate({ id }),
    isApproving: approve.isPending,
    isRejecting: reject.isPending,
    isPending: approve.isPending || reject.isPending,
  } as const;
}
