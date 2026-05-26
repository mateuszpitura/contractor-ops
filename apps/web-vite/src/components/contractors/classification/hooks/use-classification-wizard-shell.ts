import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '../../../../i18n/navigation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { AutosaveStatus } from '../wizard/classification-autosave-indicator.js';
import type { WizardAnswerValue } from '../wizard/wizard-question.js';

export function useClassificationWizardMutations(
  assessmentId: string,
  contractorId: string,
  contractorAssignmentId: string,
  initialUpdatedAt: number,
  setAutosaveStatus: (status: AutosaveStatus) => void,
  setLastSavedAt: (ts: number | null) => void,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const tError = useTranslations('Classification.error');

  const expectedUpdatedAtRef = useRef<number>(initialUpdatedAt);

  const saveAnswerMutation = useMutation(
    trpc.classification.saveAnswer.mutationOptions({
      onMutate: () => {
        setAutosaveStatus('saving');
      },
      onSuccess: data => {
        const updatedAt =
          data.updatedAt instanceof Date
            ? data.updatedAt.getTime()
            : new Date(data.updatedAt).getTime();
        expectedUpdatedAtRef.current = updatedAt;
        setLastSavedAt(updatedAt);
        setAutosaveStatus('saved');
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.classification.pathFilter());
      },
      onError: err => {
        setAutosaveStatus('error');
        toast.error(tError('autosaveNetwork'), {
          description: err.message,
        });
      },
    }),
  );

  const submitMutation = useMutation(
    trpc.classification.submit.mutationOptions({
      onSuccess: result => {
        void queryClient.invalidateQueries({
          queryKey: [['classification', 'getDraft']],
        });
        router.push(
          `/contractors/${contractorId}/engagements/${contractorAssignmentId}/classification/${result.id}`,
        );
        toast.success('Done.');
      },
      onError: err => {
        toast.error(tError('submitFailed'), {
          description: err.message,
        });
      },
    }),
  );

  const commitAnswer = useCallback(
    (questionId: string, value: WizardAnswerValue) => {
      saveAnswerMutation.mutate({
        assessmentId,
        questionId,
        answer: value.type === 'billing-ratio' ? { value: value.value } : value.value,
        expectedUpdatedAt: new Date(expectedUpdatedAtRef.current),
      });
    },
    [assessmentId, saveAnswerMutation],
  );

  const submitAssessment = useCallback(() => {
    submitMutation.mutate({ assessmentId });
  }, [assessmentId, submitMutation]);

  return {
    saveAnswerMutation,
    submitMutation,
    commitAnswer,
    submitAssessment,
    expectedUpdatedAtRef,
  } as const;
}

export function useClassificationWizardShell(
  assessmentId: string,
  contractorId: string,
  contractorAssignmentId: string,
  initialUpdatedAt: number,
) {
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const { submitMutation, commitAnswer, submitAssessment } = useClassificationWizardMutations(
    assessmentId,
    contractorId,
    contractorAssignmentId,
    initialUpdatedAt,
    setAutosaveStatus,
    setLastSavedAt,
  );

  return {
    autosaveStatus,
    lastSavedAt,
    submitMutation,
    commitAnswer,
    submitAssessment,
  } as const;
}
