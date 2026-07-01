import type { AppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

type QueueRow = inferRouterOutputs<AppRouter>['personnelFile']['pendingReviewQueue'][number];
export type PersonnelClassifyQueueRow = QueueRow;

/** The four personnel-file sections, in the enum shape the approve mutation expects. */
export type ClassifySection = 'SECTION_A' | 'SECTION_B' | 'SECTION_C' | 'SECTION_D';

/** Closed set of reject reasons appropriate to a mis-routed personnel document. */
export type ClassifyRejectReason =
  | 'wrong_employee'
  | 'not_personnel_doc'
  | 'duplicate'
  | 'illegible';

export const CLASSIFY_REJECT_REASONS: readonly ClassifyRejectReason[] = [
  'wrong_employee',
  'not_personnel_doc',
  'duplicate',
  'illegible',
];

export interface ApproveInput {
  personnelFileDocumentId: string;
  section: ClassifySection;
}

export interface RejectInput {
  personnelFileDocumentId: string;
  reason: ClassifyRejectReason;
  note?: string;
}

export interface PersonnelClassifyQueue {
  rows: PersonnelClassifyQueueRow[];
  isLoading: boolean;
  isError: boolean;
  isMutating: boolean;
  retry: () => void;
  approve: (input: ApproveInput) => void;
  reject: (input: RejectInput) => void;
}

/**
 * Sole tRPC boundary for the admin classify-review queue. Wraps the org-scoped
 * `pendingReviewQueue` query with the `classifyApprove` / `classifyReject`
 * mutations, invalidating the personnel-file namespace on success so an approved
 * document leaves the queue (and any open personnel file refreshes). The BFLA
 * fence lives on the server: the queue only ever returns the caller org's
 * awaiting documents, so no client-side org filtering is possible here.
 */
export function usePersonnelClassifyQueue(onSettled?: () => void): PersonnelClassifyQueue {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('PersonnelFile.classifyReview');

  const queueQuery = useQuery(trpc.personnelFile.pendingReviewQueue.queryOptions());

  const invalidate = () => queryClient.invalidateQueries(trpc.personnelFile.pathFilter());

  const approveMutation = useMutation(
    trpc.personnelFile.classifyApprove.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        void invalidate();
        onSettled?.();
      },
      onError: () => toast.error(t('toast.error')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.personnelFile.classifyReject.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        void invalidate();
        onSettled?.();
      },
      onError: () => toast.error(t('toast.error')),
    }),
  );

  const retry = useCallback(() => {
    void queueQuery.refetch();
  }, [queueQuery]);

  const approve = useCallback(
    (input: ApproveInput) => approveMutation.mutate(input),
    [approveMutation],
  );
  const reject = useCallback(
    (input: RejectInput) => rejectMutation.mutate(input),
    [rejectMutation],
  );

  return {
    rows: queueQuery.data ?? [],
    isLoading: queueQuery.isLoading,
    isError: queueQuery.isError,
    isMutating: approveMutation.isPending || rejectMutation.isPending,
    retry,
    approve,
    reject,
  };
}
