// Phase 59 · Plan 04 Task 3 — Engagement detail page.
// Mounts the three Phase 59 panels conditionally by countryCode:
//   - ClassificationDocumentsPanel (all countries — gates SDS for GB, DRV for DE)
//   - Ir35ChainPanel (GB only)
//   - OtherClientAttestationForm (DE only)

'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { StatusfeststellungsverfahrenPanel } from '@/components/contractors/classification/drv-clearance';
import { ClassificationDocumentsPanel } from '@/components/contractors/classification-documents';
import { Ir35ChainPanel } from '@/components/contractors/ir35-chain';
import { OtherClientAttestationForm } from '@/components/contractors/other-client-attestation';
import { trpc } from '@/trpc/init';

interface RouteParams extends Record<string, string> {
  id: string;
  engagementId: string;
}

export default function EngagementDetailPage() {
  const params = useParams<RouteParams>();
  const t = useTranslations('Classification');

  // Load the latest classification draft/completed to derive countryCode + completedAssessmentId.
  const latestQuery = useQuery({
    ...trpc.classification.getDraft.queryOptions({
      contractorAssignmentId: params.engagementId,
    }),
    retry: false,
  });

  // Also load attestation status for DRV bundle gating.
  const attestationQuery = useQuery({
    ...trpc.ir35Attestation.getForEngagement.queryOptions({
      contractorAssignmentId: params.engagementId,
    }),
    retry: false,
  });

  if (latestQuery.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label={t('loading')} />
      </div>
    );
  }

  const draft = latestQuery.data;
  const countryCode = draft?.countryCode ?? null;
  const completedAssessmentId = draft && draft.status === 'completed' ? draft.id : null;
  const attestationSigned = Boolean(attestationQuery.data?.signedAt);

  return (
    <div className="flex flex-col gap-6 py-4">
      <ClassificationDocumentsPanel
        engagementId={params.engagementId}
        countryCode={countryCode}
        completedAssessmentId={completedAssessmentId}
        attestationSigned={attestationSigned}
      />

      {countryCode === 'GB' ? <Ir35ChainPanel engagementId={params.engagementId} /> : null}

      {countryCode === 'DE' ? (
        <>
          <StatusfeststellungsverfahrenPanel engagementId={params.engagementId} />
          <OtherClientAttestationForm engagementId={params.engagementId} />
        </>
      ) : null}
    </div>
  );
}
