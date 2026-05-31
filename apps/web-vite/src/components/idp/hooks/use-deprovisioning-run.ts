/**
 * Phase 77 D-12/D-13 — sole tRPC boundary for the deprovisioning saga run view.
 * Loads the run + steps, exposes the override mutation, the override-permission
 * read, and modal-open state (mirrors use-run-header.ts).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ManualOverrideCategory } from '../override-step-dialog.js';

const MAX_ATTEMPTS = 3;

export interface DeprovisioningStepView {
  id: string;
  provider: string;
  stepKind: string;
  status: string;
  attempts: number;
  errorClass: string | null;
  lastErrorMessage: string | null;
  manualOverrideCategory: string | null;
  manualOverrideNote: string | null;
  manualOverriddenByUserId: string | null;
  manualOverriddenAt: string | Date | null;
  /** True only for FAILED + attempts>=MAX steps when the caller can override. */
  canMarkComplete: boolean;
}

export function useDeprovisioningRun(runId: string, canOverride: boolean) {
  const trpc = useTRPC();
  const t = useTranslations('Idp.runView');
  const queryClient = useQueryClient();
  const [overrideStepId, setOverrideStepId] = useState<string | null>(null);

  const runQuery = useQuery(trpc.deprovisioning.getDeprovisioningRun.queryOptions({ runId }));

  const overrideMutation = useMutation(
    trpc.deprovisioning.overrideStepFailure.mutationOptions({
      onSuccess: () => {
        toast.success(t('overrideSuccess'));
        setOverrideStepId(null);
        queryClient.invalidateQueries({
          queryKey: trpc.deprovisioning.getDeprovisioningRun.queryKey({ runId }),
        });
      },
      onError: err => toast.error(err.message || t('overrideFailure')),
    }),
  );

  const run = runQuery.data;
  const steps: DeprovisioningStepView[] = (run?.steps ?? []).map(step => ({
    id: step.id,
    provider: step.provider,
    stepKind: step.stepKind,
    status: step.status,
    attempts: step.attempts,
    errorClass: step.errorClass ?? null,
    lastErrorMessage: step.lastErrorMessage ?? null,
    manualOverrideCategory: step.manualOverrideCategory ?? null,
    manualOverrideNote: step.manualOverrideNote ?? null,
    manualOverriddenByUserId: step.manualOverriddenByUserId ?? null,
    manualOverriddenAt: step.manualOverriddenAt ?? null,
    canMarkComplete: canOverride && step.status === 'FAILED' && step.attempts >= MAX_ATTEMPTS,
  }));

  const handleOverrideSubmit = useCallback(
    async (input: { stepId: string; category: ManualOverrideCategory; note: string }) => {
      await overrideMutation.mutateAsync(input);
    },
    [overrideMutation],
  );

  return {
    isLoading: runQuery.isLoading,
    isError: runQuery.isError,
    onRetry: () => runQuery.refetch(),
    run: run ? { id: run.id, status: run.status } : null,
    steps,
    isEmpty: !(runQuery.isLoading || runQuery.isError) && steps.length === 0,
    overrideStepId,
    setOverrideStepId,
    handleOverrideSubmit,
    overridePending: overrideMutation.isPending,
    overrideServerError: overrideMutation.error?.message,
  } as const;
}
