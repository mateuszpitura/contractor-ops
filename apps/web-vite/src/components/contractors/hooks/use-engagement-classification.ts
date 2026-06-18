import type {
  Ir35Outcome,
  QuestionsSnapshot,
  ScheinselbstandigkeitOutcome,
} from '@contractor-ops/classification';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useRouter } from '../../../i18n/navigation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { WizardCountryCode } from '../classification/wizard/classification-wizard-shell.js';
import type { WizardAnswerValue } from '../classification/wizard/wizard-question.js';

const SUPPORTED_COUNTRIES = new Set<WizardCountryCode>(['GB', 'DE']);

export function useClassificationWizardEntry(engagementId: string) {
  const trpc = useTRPC();
  const t = useTranslations('Classification');
  const toasts = useCommonToasts();
  const [showDriftRecovery, setShowDriftRecovery] = useState(false);

  const draftQuery = useQuery({
    ...trpc.classification.getDraft.queryOptions({
      contractorAssignmentId: engagementId,
    }),
    enabled: Boolean(engagementId) && !showDriftRecovery,
    retry: false,
  });

  const createDraftMutation = useResourceMutation(
    trpc.classification.createDraft.mutationOptions(),
    {
      invalidate: [trpc.classification.pathFilter()],
      successMessage: toasts.done(),
    },
  );

  const recreateDraftMutation = useResourceMutation(
    trpc.classification.recreateDraftAfterDrift.mutationOptions({
      onSuccess: () => {
        setShowDriftRecovery(false);
      },
    }),
    {
      invalidate: [trpc.classification.pathFilter()],
      successMessage: toasts.done(),
    },
  );

  const driftError =
    draftQuery.error instanceof TRPCClientError &&
    draftQuery.error.data?.code === 'PRECONDITION_FAILED'
      ? draftQuery.error
      : null;

  const unsupportedCountryError =
    createDraftMutation.error instanceof TRPCClientError &&
    createDraftMutation.error.data?.code === 'UNSUPPORTED_MEDIA_TYPE';

  useEffect(() => {
    if (showDriftRecovery) return;
    if (driftError) return;
    if (draftQuery.isPending) return;
    if (draftQuery.data !== null) return;
    if (
      createDraftMutation.isPending ||
      createDraftMutation.isSuccess ||
      createDraftMutation.isError
    ) {
      return;
    }
    createDraftMutation.mutate({ contractorAssignmentId: engagementId });
  }, [
    createDraftMutation,
    draftQuery.data,
    draftQuery.isPending,
    driftError,
    engagementId,
    showDriftRecovery,
  ]);

  const draft = draftQuery.data ?? createDraftMutation.data ?? null;
  const countryCode = (draft?.countryCode ?? '').toUpperCase() as WizardCountryCode | '';
  const countrySupported = countryCode !== '' && SUPPORTED_COUNTRIES.has(countryCode);

  const initialAnswers = useMemo<Record<string, WizardAnswerValue> | undefined>(() => {
    if (!draft?.answers) return;
    return reifyAnswers(draft.answers as Record<string, unknown>);
  }, [draft?.answers]);

  const handleRecreateDraft = useCallback(() => {
    if (!draftQuery.data) return;
    setShowDriftRecovery(true);
    recreateDraftMutation.mutate({
      contractorAssignmentId: engagementId,
      staleDraftId: draftQuery.data.id,
    });
  }, [draftQuery.data, recreateDraftMutation, engagementId]);

  const isLoading =
    draftQuery.isPending ||
    createDraftMutation.isPending ||
    recreateDraftMutation.isPending ||
    draft === null;

  const initialUpdatedAt = draft
    ? draft.updatedAt instanceof Date
      ? draft.updatedAt.getTime()
      : new Date(draft.updatedAt).getTime()
    : 0;

  return {
    t,
    driftError,
    unsupportedCountryError,
    draft,
    countryCode,
    countrySupported,
    initialAnswers,
    initialUpdatedAt,
    handleRecreateDraft,
    recreateDraftMutation,
    draftQuery,
    isLoading,
  } as const;
}

export function useClassificationOutcome(assessmentId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [disclaimerDeferred, setDisclaimerDeferred] = useState(false);

  const assessmentQuery = useQuery({
    ...trpc.classification.getById.queryOptions({ assessmentId }),
    enabled: Boolean(assessmentId),
    retry: false,
  });

  const handleAcknowledged = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['classification', 'getById']],
    });
  }, [queryClient]);

  const handleDeferred = useCallback((navigate: () => void) => {
    setDisclaimerDeferred(true);
    navigate();
  }, []);

  return {
    assessmentQuery,
    disclaimerDeferred,
    handleAcknowledged,
    handleDeferred,
  } as const;
}

const SUPPORTED_OUTCOME_COUNTRIES = new Set(['GB', 'DE']);

/**
 * Status flags for the outcome-screen JSX wiring. Container renders one of
 * the branches based on these flags — no derivation lives in the container.
 */
export type OutcomeStatus =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'unsupported-country'; countryCode: string }
  | { kind: 'missing-outcome' }
  | {
      kind: 'ready';
      readonly assessment: {
        readonly id: string;
        readonly countryCode: 'GB' | 'DE';
        readonly outcome: Ir35Outcome | ScheinselbstandigkeitOutcome;
        readonly questionsSnapshot: QuestionsSnapshot;
        readonly ruleSetVersion: string;
        readonly disclaimerAcknowledgedAt: Date | string | null;
      };
      readonly answers: Record<string, unknown>;
      readonly completedDateStr: string;
      readonly disclaimerOpen: boolean;
    };

export function useClassificationOutcomeView(
  assessmentId: string,
  contractorId: string,
  engagementId: string,
) {
  const router = useRouter();
  const { formatDateTime } = useDateFormatter();
  const { assessmentQuery, disclaimerDeferred, handleAcknowledged, handleDeferred } =
    useClassificationOutcome(assessmentId);

  const handleDeferredNavigate = useCallback(() => {
    handleDeferred(() => router.push(`/contractors/${contractorId}/engagements/${engagementId}`));
  }, [contractorId, engagementId, handleDeferred, router]);

  const handleRerun = useCallback(() => {
    void router.push(`/contractors/${contractorId}/engagements/${engagementId}/classification`);
  }, [contractorId, engagementId, router]);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential guard chain deriving a discriminated OutcomeStatus union — each early return maps one distinct state (loading/not-found/unsupported/missing/ready) and is not factorable without losing the narrowing order
  const status = useMemo<OutcomeStatus>(() => {
    if (assessmentQuery.isPending) return { kind: 'loading' };
    const assessment = assessmentQuery.data;
    if (!assessment || assessment.id !== assessmentId) return { kind: 'not-found' };
    const countryCode = assessment.countryCode?.toUpperCase();
    if (!(countryCode && SUPPORTED_OUTCOME_COUNTRIES.has(countryCode))) {
      return { kind: 'unsupported-country', countryCode: countryCode || '—' };
    }
    const outcome = assessment.outcome as Ir35Outcome | ScheinselbstandigkeitOutcome | null;
    const snapshot = assessment.questionsSnapshot as QuestionsSnapshot | null;
    if (!(outcome && snapshot)) return { kind: 'missing-outcome' };

    const completedDate =
      assessment.completedAt instanceof Date
        ? assessment.completedAt
        : assessment.completedAt
          ? new Date(assessment.completedAt)
          : null;
    const completedDateStr = completedDate ? formatDateTime(completedDate) : '—';
    const disclaimerOpen = assessment.disclaimerAcknowledgedAt === null && !disclaimerDeferred;

    return {
      kind: 'ready',
      assessment: {
        id: assessment.id,
        countryCode: countryCode as 'GB' | 'DE',
        outcome,
        questionsSnapshot: snapshot,
        ruleSetVersion: assessment.ruleSetVersion,
        disclaimerAcknowledgedAt: assessment.disclaimerAcknowledgedAt ?? null,
      },
      answers: (assessment.answers as Record<string, unknown>) ?? {},
      completedDateStr,
      disclaimerOpen,
    };
  }, [
    assessmentId,
    assessmentQuery.data,
    assessmentQuery.isPending,
    disclaimerDeferred,
    formatDateTime,
  ]);

  return {
    status,
    handleAcknowledged,
    handleDeferredNavigate,
    handleRerun,
    handlePrint,
  } as const;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: type-narrowing parser over `unknown` persisted answers — one branch per answer-value shape (yes-no/likert/score/billing-ratio) with shape-specific range validation; flattening the guards is intrinsic to the parse
function reifyAnswers(raw: Record<string, unknown>): Record<string, WizardAnswerValue> {
  const result: Record<string, WizardAnswerValue> = {};
  for (const [questionId, persisted] of Object.entries(raw)) {
    const value = persisted as unknown;
    if (typeof value === 'string' && (value === 'yes' || value === 'no')) {
      result[questionId] = { type: 'yes-no', value };
      continue;
    }
    if (typeof value === 'number' && value >= 1 && value <= 5 && Number.isInteger(value)) {
      result[questionId] = { type: 'likert-5', value: value as 1 | 2 | 3 | 4 | 5 };
      continue;
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      'rawScore' in value &&
      'isNotApplicable' in value
    ) {
      const score = value as { rawScore: number; isNotApplicable: boolean };
      if (
        Number.isInteger(score.rawScore) &&
        score.rawScore >= 0 &&
        score.rawScore <= 3 &&
        typeof score.isNotApplicable === 'boolean'
      ) {
        result[questionId] = {
          type: 'score-0-3',
          value: {
            rawScore: score.rawScore as 0 | 1 | 2 | 3,
            isNotApplicable: score.isNotApplicable,
          },
        };
        continue;
      }
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      'value' in value &&
      typeof (value as { value: unknown }).value === 'number'
    ) {
      const num = (value as { value: number }).value;
      if (num >= 0 && num <= 100) {
        result[questionId] = { type: 'billing-ratio', value: num };
      }
    }
  }
  return result;
}

export function parseDriftVersions(message: string): [string | null, string | null] {
  const match = /against\s+(\S+)\s+but current profile is\s+(\S+?)\./i.exec(message);
  if (!match) return [null, null];
  return [match[1] ?? null, match[2] ?? null];
}
