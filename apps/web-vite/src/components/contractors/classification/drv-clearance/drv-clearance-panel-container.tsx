import { useDrvClearanceList, useDrvDecisionLetterUpload } from '../hooks/use-drv-clearance.js';
import type { StatusfeststellungsverfahrenPanelProps } from './drv-clearance-panel.js';
import { StatusfeststellungsverfahrenPanelView } from './drv-clearance-panel.js';
import type { DrvClearanceRowData } from './drv-clearance-row.js';

// Decision: composition — pairs useDrvClearanceList query with
// useDrvDecisionLetterUpload mutation in one panel; engagement-detail
// gates mounting via DE country check.
export function StatusfeststellungsverfahrenPanelContainer(
  props: StatusfeststellungsverfahrenPanelProps,
) {
  const { rows } = useDrvClearanceList(props.engagementId);
  const { uploadMutation, isPending: uploadPending } = useDrvDecisionLetterUpload(
    props.classificationAssessmentId,
  );

  return (
    <StatusfeststellungsverfahrenPanelView
      {...props}
      rows={(rows ?? []) as DrvClearanceRowData[]}
      uploadMutation={uploadMutation}
      uploadPending={uploadPending}
    />
  );
}
