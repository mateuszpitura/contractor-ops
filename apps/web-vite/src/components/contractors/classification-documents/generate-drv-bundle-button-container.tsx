import { useGenerateDrvBundle } from '../hooks/use-classification-documents.js';
import type { GenerateDrvBundleButtonProps } from './generate-drv-bundle-button.js';
import { GenerateDrvBundleButtonView } from './generate-drv-bundle-button.js';

// Decision: render gated externally by parent (classification-documents-panel
// mounts only for DE assessments). Container's job is to keep the
// generateDrvDefenseBundle mutation out of the view.
export function GenerateDrvBundleButtonContainer(props: GenerateDrvBundleButtonProps) {
  const drv = useGenerateDrvBundle(props.classificationAssessmentId);
  return <GenerateDrvBundleButtonView {...props} {...drv} />;
}
