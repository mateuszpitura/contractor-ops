import { useDrvClearanceList, useDrvDecisionLetterUpload } from '../hooks/use-drv-clearance.js';
import type { StatusfeststellungsverfahrenPanelProps } from './drv-clearance-panel.js';
import { StatusfeststellungsverfahrenPanelView } from './drv-clearance-panel.js';
import type { DrvClearanceRowData } from './drv-clearance-row.js';

// Decision: render gated externally by parent (engagement-detail country gate).
// This container's job is to keep the list query + decision-letter upload
// mutation out of the presentational panel.
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
