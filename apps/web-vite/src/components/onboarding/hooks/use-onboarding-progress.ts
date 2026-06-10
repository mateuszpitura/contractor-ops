import type { AppRouter } from '@contractor-ops/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type OnboardingProgressData = RouterOutputs['onboardingImport']['getProgress'];

export type OnboardingProgressFailedItem = OnboardingProgressData['failedItems'][number];

export interface UseOnboardingProgressParams {
  jobId: string;
}

export interface UseOnboardingProgressResult {
  isError: boolean;
  hasData: boolean;
  progress: OnboardingProgressData | undefined;
  isComplete: boolean;
  isFailed: boolean;
  isRunning: boolean;
  percentDone: number;
  handleRefetch: () => void;
  handleRetry: (email: string) => void;
  retryingItemKey: string | null;
}

const POLL_INTERVAL_MS = 2000;

export function useOnboardingProgress(
  params: UseOnboardingProgressParams,
): UseOnboardingProgressResult {
  const { jobId } = params;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const progressQuery = useQuery({
    ...trpc.onboardingImport.getProgress.queryOptions({ jobId }),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : POLL_INTERVAL_MS;
    },
  });

  const retryMutation = useResourceMutation(
    trpc.onboardingImport.retryFailedItem.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.onboardingImport.getProgress.queryKey({ jobId }),
        });
      },
    }),
    { successMessage: toasts.done() },
  );

  const progress = progressQuery.data;
  const isComplete = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';
  const isRunning = !!progress && !isComplete && !isFailed;
  const percentDone =
    progress && progress.totalItems > 0
      ? Math.round((progress.completedItems / progress.totalItems) * 100)
      : 0;

  const handleRefetch = useCallback(() => {
    void progressQuery.refetch();
  }, [progressQuery]);

  const handleRetry = useCallback(
    (email: string) => {
      retryMutation.mutate({ jobId, itemKey: email });
    },
    [retryMutation, jobId],
  );

  return {
    isError: progressQuery.isError,
    hasData: !!progress,
    progress,
    isComplete,
    isFailed,
    isRunning,
    percentDone,
    handleRefetch,
    handleRetry,
    retryingItemKey: retryMutation.isPending ? (retryMutation.variables?.itemKey ?? null) : null,
  };
}
