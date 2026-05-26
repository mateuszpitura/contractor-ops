import { useGenerateDrvBundle } from '../hooks/use-classification-documents.js';
import type { GenerateDrvBundleButtonProps } from './generate-drv-bundle-button.js';
import { GenerateDrvBundleButtonView } from './generate-drv-bundle-button.js';

// Decision: mutation host — generateDrvDefenseBundle isolated from view.
// ClassificationDocumentsPanel mounts this only for DE assessments.
export function GenerateDrvBundleButtonContainer(props: GenerateDrvBundleButtonProps) {
  const drv = useGenerateDrvBundle(props.classificationAssessmentId);
  return <GenerateDrvBundleButtonView {...props} {...drv} />;
}
