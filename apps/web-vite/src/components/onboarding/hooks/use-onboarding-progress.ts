import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface OnboardingProgressFailedItem {
  email: string;
  error: string;
}

export interface OnboardingProgressData {
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  completedItems: number;
  totalItems: number;
  failedItems: OnboardingProgressFailedItem[];
}

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
  isRetrying: boolean;
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
      const status = (query.state.data as OnboardingProgressData | undefined)?.status;
      return status === 'completed' || status === 'failed' ? false : POLL_INTERVAL_MS;
    },
  });

  const retryMutation = useMutation({
    ...trpc.onboardingImport.retryFailedItem.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.onboardingImport.getProgress.queryKey({ jobId }),
      });
      toast.success(toasts.done());
    },
    onError: err => toast.error(err.message),
  });

  const progress = progressQuery.data as OnboardingProgressData | undefined;
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
      retryMutation.mutate({ jobId, email });
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
    isRetrying: retryMutation.isPending,
  };
}
