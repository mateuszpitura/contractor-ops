import { useParams } from 'react-router-dom';

import { ClassificationAssessmentListContainer } from './classification/classification-assessment-list-container.js';

// Decision: resolve `contractorId` from the route param + wrap the assessment
// list in the section layout. This satisfies the route-param-resolution
// criterion from ARCHITECTURE.md.
export function ContractorClassificationContainer() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id ?? '';

  return (
    <div className="flex flex-col gap-4 py-4">
      <ClassificationAssessmentListContainer contractorId={contractorId} />
    </div>
  );
}
