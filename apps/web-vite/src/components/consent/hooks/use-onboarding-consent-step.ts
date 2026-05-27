/**
 * Data hook for the onboarding-consent step — privacy notice fetch + bulk
 * consent grant mutation. Split out of the widget UI per
 * `apps/web-vite/ARCHITECTURE.md` so the tRPC/React Query layer stays
 * inside `components/{domain}/hooks/`.
 */

import type { ConsentPurpose, SupportedJurisdiction } from '@contractor-ops/validators';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type BulkGrantPayload = {
  consents: Array<{ purpose: ConsentPurpose; granted: true }>;
  privacyNoticeAcknowledged: true;
  privacyNoticeJurisdiction: SupportedJurisdiction;
  privacyNoticeVersion: number;
};

export function useOnboardingConsentStep(onComplete: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const noticeQuery = useQuery(trpc.consent.getPrivacyNotice.queryOptions());

  const bulkGrant = useMutation(
    trpc.consent.bulkGrant.mutationOptions({
      onSuccess: () => {
        onComplete();
        toast.success(toasts.done());
        void queryClient.invalidateQueries(trpc.consent.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  return {
    notice: noticeQuery.data,
    noticeLoading: noticeQuery.isPending,
    submit: (payload: BulkGrantPayload) => bulkGrant.mutate(payload),
    isSubmitting: bulkGrant.isPending,
  } as const;
}
