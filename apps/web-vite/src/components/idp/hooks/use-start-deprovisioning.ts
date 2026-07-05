/**
 * Sole tRPC boundary for the deprovisioning start path. Serves both entry
 * points (assignment detail + ACCESS_REVOKE task card) through one hook:
 *
 *   - assignmentId given directly (detail surface), OR
 *   - contractorId given (task card) → one server resolver call
 *     (resolveAssignmentForContractor) yields the assignmentId, keeping the
 *     web-vite data-layer guard green (no client-side resolution).
 *
 * Exposes the cooldown eligibility gate, a deterministic per-assignment
 * idempotencyKey, the start mutation, and the resulting run id so the
 * container can swap "start" → "view run" once a run exists for the assignment.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface UseStartDeprovisioningInput {
  /** Detail-surface path: the assignment is unambiguous. */
  assignmentId?: string;
  /** Task-card path: resolve the assignment server-side from the contractor. */
  contractorId?: string;
}

const IDEMPOTENCY_PREFIX = 'deprov:';
const IDEMPOTENCY_MAX = 128;

/**
 * Deterministic, per-assignment key. A re-trigger for the same
 * assignment collides on the server unique index (P2002) and returns the
 * existing run rather than starting a second one. Clamped to the server bound
 * (min 8 / max 128) — assignment ids are cuids well within range, but the
 * clamp keeps the contract explicit.
 */
export function deriveIdempotencyKey(assignmentId: string): string {
  return `${IDEMPOTENCY_PREFIX}${assignmentId}`.slice(0, IDEMPOTENCY_MAX);
}

export function useStartDeprovisioning({
  assignmentId: directAssignmentId,
  contractorId,
}: UseStartDeprovisioningInput) {
  const trpc = useTRPC();
  const t = useTranslations('Idp.trigger');
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);

  const resolverQuery = useQuery({
    ...trpc.deprovisioning.resolveAssignmentForContractor.queryOptions({
      contractorId: contractorId ?? '',
    }),
    enabled: !directAssignmentId && !!contractorId,
  });

  const assignmentId = directAssignmentId ?? resolverQuery.data?.assignmentId ?? null;

  const eligibilityQuery = useQuery({
    ...trpc.deprovisioning.getDeprovisioningEligibility.queryOptions({
      assignmentId: assignmentId ?? '',
    }),
    enabled: !!assignmentId,
  });

  const idempotencyKey = useMemo(
    () => (assignmentId ? deriveIdempotencyKey(assignmentId) : null),
    [assignmentId],
  );

  const startMutation = useMutation(
    trpc.deprovisioning.startDeprovisioningRun.mutationOptions({
      onSuccess: ({ runId }) => {
        setStartedRunId(runId);
        setConfirmOpen(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.deprovisioning.getDeprovisioningEligibility.queryKey({
            assignmentId: assignmentId ?? '',
          }),
        });
      },
      onError: err => {
        const text = translateError(err);
        toast.error(text || t('startFailure'));
      },
    }),
  );

  const start = useCallback(() => {
    if (!(assignmentId && idempotencyKey) || startMutation.isPending) return;
    startMutation.mutate({ subjectType: 'CONTRACTOR', assignmentId, idempotencyKey });
  }, [assignmentId, idempotencyKey, startMutation]);

  const eligibility = eligibilityQuery.data;
  const resolvedToNull =
    !directAssignmentId && resolverQuery.isSuccess && !resolverQuery.data?.assignmentId;

  return {
    assignmentId,
    idempotencyKey,
    isLoading:
      (!directAssignmentId && !!contractorId && resolverQuery.isLoading) ||
      (!!assignmentId && eligibilityQuery.isLoading),
    isError: resolverQuery.isError || eligibilityQuery.isError,
    onRetry: () => {
      void resolverQuery.refetch();
      void eligibilityQuery.refetch();
    },
    isUnresolved: resolvedToNull,
    allowed: eligibility?.allowed ?? false,
    earliestDate: eligibility?.earliestDate ?? null,
    reason: eligibility?.reason ?? null,
    startedRunId,
    confirmOpen,
    openConfirm: () => setConfirmOpen(true),
    closeConfirm: () => setConfirmOpen(false),
    start,
    isStarting: startMutation.isPending,
  } as const;
}
