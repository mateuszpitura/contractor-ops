import { useParams } from 'react-router-dom';

import { ClassificationAssessmentListContainer } from './classification/classification-assessment-list-container.js';

// Decision: route-param resolution — extracts :id from useParams() and
// forwards as contractorId to ClassificationAssessmentListContainer inside
// the section layout wrapper.
export function ContractorClassificationContainer() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id ?? '';

  return (
    <div className="flex flex-col gap-4 py-4">
      <ClassificationAssessmentListContainer contractorId={contractorId} />
    </div>
  );
}
