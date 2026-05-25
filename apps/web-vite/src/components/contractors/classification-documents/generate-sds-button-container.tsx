import { useGenerateSds } from '../hooks/use-classification-documents.js';
import type { GenerateSdsButtonProps } from './generate-sds-button.js';
import { GenerateSdsButtonView } from './generate-sds-button.js';

// Decision: render gated externally by parent (classification-documents-panel
// mounts only for GB outside-IR35 assessments). Container's job is to keep
// approveSds + generateSds mutations out of the view.
export function GenerateSdsButtonContainer(props: GenerateSdsButtonProps) {
  const sds = useGenerateSds(props.classificationAssessmentId);
  return <GenerateSdsButtonView {...props} {...sds} />;
}
