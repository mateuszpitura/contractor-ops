import { useGenerateSds } from '../hooks/use-classification-documents.js';
import type { GenerateSdsButtonProps } from './generate-sds-button.js';
import { GenerateSdsButtonView } from './generate-sds-button.js';

// Decision: mutation host — approveSds + generateSds isolated from view.
// ClassificationDocumentsPanel mounts this only for GB outside-IR35.
export function GenerateSdsButtonContainer(props: GenerateSdsButtonProps) {
  const sds = useGenerateSds(props.classificationAssessmentId);
  return <GenerateSdsButtonView {...props} {...sds} />;
}
