/**
 * Data hook for the onboarding-consent step — privacy notice fetch + bulk
 * consent grant mutation. Split out of the widget UI per
 * `apps/web-vite/ARCHITECTURE.md` so the tRPC/React Query layer stays
 * inside `components/{domain}/hooks/`.
 */

import type { ConsentPurpose, SupportedJurisdiction } from '@contractor-ops/validators';
import { useQuery } from '@tanstack/react-query';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
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
  const toasts = useCommonToasts();

  const noticeQuery = useQuery(trpc.consent.getPrivacyNotice.queryOptions());

  const bulkGrant = useResourceMutation(
    trpc.consent.bulkGrant.mutationOptions({
      onSuccess: () => {
        onComplete();
      },
    }),
    {
      successMessage: toasts.done(),
      invalidate: [trpc.consent.pathFilter()],
    },
  );

  return {
    notice: noticeQuery.data,
    noticeLoading: noticeQuery.isPending,
    submit: (payload: BulkGrantPayload) => bulkGrant.mutate(payload),
    isSubmitting: bulkGrant.isPending,
  } as const;
}
