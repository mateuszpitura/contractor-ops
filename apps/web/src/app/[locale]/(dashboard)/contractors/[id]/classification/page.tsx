'use client';

// ---------------------------------------------------------------------------
// Contractor classification history route — Phase 58 Plan 05 Task 2.
// ---------------------------------------------------------------------------
// Renders ClassificationAssessmentList for the contractor at
// /[locale]/contractors/[id]/classification. Thin page — the heavy lifting
// (table vs card responsive layout, draft-first ordering) lives in the
// list component so it can also be mounted inside the contractor profile
// tabs or rendered by future embed points.

import { useParams } from 'next/navigation';

import { ClassificationAssessmentList } from '@/components/contractors/classification/classification-assessment-list';

interface RouteParams extends Record<string, string> {
  id: string;
}

export default function ContractorClassificationPage() {
  const params = useParams<RouteParams>();
  return (
    <div className="flex flex-col gap-4 py-4">
      <ClassificationAssessmentList contractorId={params.id} />
    </div>
  );
}
