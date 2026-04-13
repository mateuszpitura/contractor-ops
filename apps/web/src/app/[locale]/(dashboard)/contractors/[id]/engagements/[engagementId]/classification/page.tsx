'use client';

// ---------------------------------------------------------------------------
// Classification wizard entry — /contractors/[id]/engagements/[engagementId]/classification
// ---------------------------------------------------------------------------
// Plan 04 — creates/fetches the draft via tRPC. The draft row carries
// countryCode so we can discriminate GB (IR35) vs DE (Scheinselbständigkeit)
// from a single network round-trip. Rule-set drift (PRECONDITION_FAILED on
// getDraft) is surfaced with a blocking "Start a new assessment" CTA that
// calls `recreateDraftAfterDrift` (preserving the stale draft per D-04).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/trpc/init';

import {
  ClassificationWizardShell,
  type WizardCountryCode,
} from '@/components/contractors/classification/wizard/classification-wizard-shell';
import type { WizardAnswerValue } from '@/components/contractors/classification/wizard/wizard-question';

interface RouteParams extends Record<string, string> {
  id: string;
  engagementId: string;
}

const SUPPORTED_COUNTRIES = new Set<WizardCountryCode>(['GB', 'DE']);

export default function ClassificationWizardPage() {
  const params = useParams<RouteParams>();
  const t = useTranslations('Classification');
  const queryClient = useQueryClient();

  const [showDriftRecovery, setShowDriftRecovery] = useState(false);

  const draftQuery = useQuery({
    ...trpc.classification.getDraft.queryOptions({
      contractorAssignmentId: params.engagementId,
    }),
    enabled: !showDriftRecovery,
    retry: false,
  });

  const createDraftMutation = useMutation(
    trpc.classification.createDraft.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['classification', 'getDraft']],
        });
      },
    }),
  );

  const recreateDraftMutation = useMutation(
    trpc.classification.recreateDraftAfterDrift.mutationOptions({
      onSuccess: () => {
        setShowDriftRecovery(false);
        void queryClient.invalidateQueries({
          queryKey: [['classification', 'getDraft']],
        });
      },
    }),
  );

  // Rule-set drift detection — PRECONDITION_FAILED surfaces here.
  const driftError =
    draftQuery.error &&
    (draftQuery.error as unknown as { data?: { code?: string } }).data?.code ===
      'PRECONDITION_FAILED'
      ? (draftQuery.error as unknown as { message: string })
      : null;

  // Country-not-supported detection via the createDraft error code
  // (UNSUPPORTED_MEDIA_TYPE — mapped in the tRPC router).
  const unsupportedCountryError =
    createDraftMutation.error &&
    (createDraftMutation.error as { data?: { code?: string } }).data?.code ===
      'UNSUPPORTED_MEDIA_TYPE';

  // Auto-create a fresh draft if none exists. getDraft returns null when
  // no draft has been started yet.
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
    createDraftMutation.mutate({ contractorAssignmentId: params.engagementId });
  }, [
    createDraftMutation,
    draftQuery.data,
    draftQuery.isPending,
    driftError,
    params.engagementId,
    showDriftRecovery,
  ]);

  const draft = draftQuery.data ?? createDraftMutation.data ?? null;
  const countryCode = (draft?.countryCode ?? '').toUpperCase() as WizardCountryCode | '';
  const countrySupported = countryCode !== '' && SUPPORTED_COUNTRIES.has(countryCode);

  const initialAnswers = useMemo<Record<string, WizardAnswerValue> | undefined>(() => {
    if (!draft?.answers) return undefined;
    return reifyAnswers(draft.answers as Record<string, unknown>);
  }, [draft?.answers]);

  // Rule-set drift — render the blocked UI with the start-new CTA.
  if (driftError) {
    const [oldVersion, newVersion] = parseDriftVersions(driftError.message);
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive" role="alert">
          <AlertTitle>{t('error.draftDrift')}</AlertTitle>
          <AlertDescription>
            {t('error.draftDriftBody', {
              oldVersion: oldVersion ?? '?',
              newVersion: newVersion ?? '?',
            })}
          </AlertDescription>
        </Alert>
        <div>
          <Button
            onClick={() => {
              if (!draftQuery.data) return;
              setShowDriftRecovery(true);
              recreateDraftMutation.mutate({
                contractorAssignmentId: params.engagementId,
                staleDraftId: draftQuery.data.id,
              });
            }}
            disabled={recreateDraftMutation.isPending || !draftQuery.data}>
            {t('error.startNew')}
          </Button>
        </div>
      </div>
    );
  }

  if (unsupportedCountryError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('emptyState.notSupported')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('emptyState.notSupportedBody', { countryCode: '—' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (
    draftQuery.isPending ||
    createDraftMutation.isPending ||
    recreateDraftMutation.isPending ||
    draft === null
  ) {
    return <WizardLoading />;
  }

  if (!countrySupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('emptyState.notSupported')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('emptyState.notSupportedBody', { countryCode: countryCode || '—' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  const initialUpdatedAt =
    draft.updatedAt instanceof Date
      ? draft.updatedAt.getTime()
      : new Date(draft.updatedAt).getTime();

  return (
    <ClassificationWizardShell
      assessmentId={draft.id}
      contractorAssignmentId={params.engagementId}
      contractorId={params.id}
      countryCode={countryCode as WizardCountryCode}
      initialUpdatedAt={initialUpdatedAt}
      initialAnswers={initialAnswers}
    />
  );
}

function WizardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[240px] flex-col items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Parse tRPC drift error message of the shape:
 *   "Rule-set drift: draft was started against IR35-2023 but current profile is IR35-2024-CEST. Start a new assessment."
 */
function parseDriftVersions(message: string): [string | null, string | null] {
  const match = /against\s+(\S+)\s+but current profile is\s+(\S+?)\./i.exec(message);
  if (!match) return [null, null];
  return [match[1] ?? null, match[2] ?? null];
}

/**
 * Re-hydrate persisted JSONB answers into the discriminated WizardAnswerValue
 * shape the wizard form state expects. Unknown shapes are dropped silently —
 * the server-side Zod schemas on saveAnswer are the authoritative gatekeeper.
 */
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
