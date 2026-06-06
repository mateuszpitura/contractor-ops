/**
 * Phase 81 D-01/D-03/D-09/D-11 — sole tRPC boundary for the deprovisioning
 * start path. Serves BOTH entry points (assignment detail + ACCESS_REVOKE task
 * card) through one hook:
 *
 *   - assignmentId given directly (detail surface), OR
 *   - contractorId given (task card) → one server resolver call
 *     (resolveAssignmentForContractor, 81-02) yields the assignmentId, so the
 *     web-vite data-layer guard stays green (no client-side resolution).
 *
 * Exposes the cooldown eligibility gate (D-11), a deterministic per-assignment
 * idempotencyKey (D-09), the start mutation, and the resulting run id so the
 * container can swap "start" → "view run" once a run exists for the assignment.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
 * Deterministic, per-assignment key (D-09). A re-trigger for the same
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
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);

  // D-01 task-card path: a single server round-trip resolves contractorId →
  // assignmentId. Only enabled when no direct assignmentId was provided.
  const resolverQuery = useQuery({
    ...trpc.deprovisioning.resolveAssignmentForContractor.queryOptions({
      contractorId: contractorId ?? '',
    }),
    enabled: !directAssignmentId && !!contractorId,
  });

  const assignmentId = directAssignmentId ?? resolverQuery.data?.assignmentId ?? null;

  // D-11 cooldown gate. Disabled until we have a concrete assignmentId.
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
        // D-03 — surface the existing run-view (rendered in place by the
        // container). D-09 — a P2002 collision returns the same run id.
        setStartedRunId(runId);
        setConfirmOpen(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.deprovisioning.getDeprovisioningEligibility.queryKey({
            assignmentId: assignmentId ?? '',
          }),
        });
      },
      onError: err => toast.error(err.message || t('startFailure')),
    }),
  );

  const start = useCallback(() => {
    if (!(assignmentId && idempotencyKey) || startMutation.isPending) return;
    startMutation.mutate({ assignmentId, idempotencyKey });
  }, [assignmentId, idempotencyKey, startMutation]);

  const eligibility = eligibilityQuery.data;
  // The resolver can legitimately return null (no ENDED assignment) — that is
  // a "not configured / nothing to deprovision" empty state, not an error.
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
    /** No assignment to act on (contractor never had an ENDED engagement). */
    isUnresolved: resolvedToNull,
    /** D-11 cooldown — false while inside the 14-day window. */
    allowed: eligibility?.allowed ?? false,
    earliestDate: eligibility?.earliestDate ?? null,
    reason: eligibility?.reason ?? null,
    /** D-09 — non-null once a run exists for this assignment. */
    startedRunId,
    confirmOpen,
    openConfirm: () => setConfirmOpen(true),
    closeConfirm: () => setConfirmOpen(false),
    start,
    isStarting: startMutation.isPending,
  } as const;
}
