/**
 * Sole tRPC boundary for the employee on/offboarding lifecycle surface. Exposes
 * the read state (displayName / employmentStatus / terminatedAt — the gate the
 * panel uses to enable the IdP deprovisioning trigger) plus the four lifecycle
 * mutations. The 14-day cooldown stays server-side (Plan 04) — this hook never
 * decides eligibility.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type LifecycleCertType =
  | 'SWIADECTWO_PRACY'
  | 'PIT_11'
  | 'ARBEITSZEUGNIS_SIMPLE'
  | 'LOHNSTEUERBESCHEINIGUNG'
  | 'P45'
  | 'W2';

export function useEmployeeLifecycle(workerId: string) {
  const trpc = useTRPC();
  const t = useTranslations('EmployeeLifecycle');
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();
  const [startedRunIds, setStartedRunIds] = useState<string[]>([]);
  const [certDownloadUrl, setCertDownloadUrl] = useState<string | null>(null);

  const getQuery = useQuery(trpc.employeeLifecycle.get.queryOptions({ workerId }));

  const invalidateGet = () =>
    void queryClient.invalidateQueries({
      queryKey: trpc.employeeLifecycle.get.queryKey({ workerId }),
    });

  const onError = (err: { message?: string }) =>
    toast.error(translateError(err) || t('errors.generic'));

  const startOnboarding = useMutation(
    trpc.employeeLifecycle.startOnboarding.mutationOptions({
      onSuccess: ({ runId }) => {
        setStartedRunIds(prev => [...prev, runId]);
        toast.success(t('toasts.onboardingStarted'));
      },
      onError,
    }),
  );

  const startOffboarding = useMutation(
    trpc.employeeLifecycle.startOffboarding.mutationOptions({
      onSuccess: ({ runId }) => {
        setStartedRunIds(prev => [...prev, runId]);
        toast.success(t('toasts.offboardingStarted'));
      },
      onError,
    }),
  );

  const recordTermination = useMutation(
    trpc.employeeLifecycle.recordTermination.mutationOptions({
      onSuccess: () => {
        invalidateGet();
        toast.success(t('toasts.terminationRecorded'));
      },
      onError,
    }),
  );

  const generateCert = useMutation(
    trpc.employeeLifecycle.generateCert.mutationOptions({
      onSuccess: ({ downloadUrl }) => {
        setCertDownloadUrl(downloadUrl);
        toast.success(t('toasts.certGenerated'));
      },
      onError,
    }),
  );

  return {
    workerId,
    displayName: getQuery.data?.displayName ?? null,
    terminatedAt: getQuery.data?.terminatedAt ?? null,
    employmentStatus: getQuery.data?.employmentStatus ?? null,
    isLoading: getQuery.isLoading,
    isError: getQuery.isError,
    retry: () => void getQuery.refetch(),
    startedRunIds,
    certDownloadUrl,
    startOnboarding: () => startOnboarding.mutate({ workerId }),
    startOffboarding: () => startOffboarding.mutate({ workerId }),
    recordTermination: (terminatedAt: string) =>
      recordTermination.mutate({ workerId, terminatedAt }),
    generateCert: (certType: LifecycleCertType, workflowRunId: string) =>
      generateCert.mutate({ workflowRunId, workerId, certType }),
    isStartingOnboarding: startOnboarding.isPending,
    isStartingOffboarding: startOffboarding.isPending,
    isRecordingTermination: recordTermination.isPending,
    isGeneratingCert: generateCert.isPending,
  } as const;
}
