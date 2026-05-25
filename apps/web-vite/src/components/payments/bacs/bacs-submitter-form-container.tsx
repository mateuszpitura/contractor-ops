import { useBacsSubmitterForm } from '../hooks/use-bacs-submitter-form.js';
import { BacsSubmitterForm } from './bacs-submitter-form.js';

interface BacsSubmitterFormContainerProps {
  featureEnabled: boolean;
}

export function BacsSubmitterFormContainer({ featureEnabled }: BacsSubmitterFormContainerProps) {
  const submitter = useBacsSubmitterForm();
  return <BacsSubmitterForm featureEnabled={featureEnabled} submitter={submitter} />;
}
