import { useParams } from 'react-router-dom';

import { ClassificationAssessmentList } from './classification/classification-assessment-list.js';

export function ContractorClassification() {
  const params = useParams<{ id: string }>();
  const contractorId = params.id ?? '';

  return (
    <div className="flex flex-col gap-4 py-4">
      <ClassificationAssessmentList contractorId={contractorId} />
    </div>
  );
}
