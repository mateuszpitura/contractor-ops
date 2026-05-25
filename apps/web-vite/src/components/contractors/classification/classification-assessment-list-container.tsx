import type { ClassificationAssessmentListViewProps } from './classification-assessment-list.js';
import {
  ClassificationAssessmentListEmpty,
  ClassificationAssessmentListSkeleton,
  ClassificationAssessmentListView,
} from './classification-assessment-list.js';
import { useClassificationAssessmentList } from './hooks/use-classification-assessment-list.js';

export function ClassificationAssessmentListContainer(
  props: Pick<ClassificationAssessmentListViewProps, 'contractorId'>,
) {
  const { rows, isPending } = useClassificationAssessmentList(props.contractorId);

  if (isPending) return <ClassificationAssessmentListSkeleton />;
  if (rows.length === 0) return <ClassificationAssessmentListEmpty />;

  return <ClassificationAssessmentListView contractorId={props.contractorId} rows={rows} />;
}
