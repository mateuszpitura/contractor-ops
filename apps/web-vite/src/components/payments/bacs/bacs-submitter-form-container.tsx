import { useBacsSubmitterForm } from '../hooks/use-bacs-submitter-form.js';
import { BacsSubmitterForm } from './bacs-submitter-form.js';

interface BacsSubmitterFormContainerProps {
  featureEnabled: boolean;
}

// Decision: form host — view owns react-hook-form locally; useBacsSubmitterForm
// supplies the save mutation, mask query, and submitter-name sync into the RHF
// reset cycle. featureEnabled forwarded by SettingsPaymentsContainer.
export function BacsSubmitterFormContainer({ featureEnabled }: BacsSubmitterFormContainerProps) {
  const submitter = useBacsSubmitterForm();
  return <BacsSubmitterForm featureEnabled={featureEnabled} submitter={submitter} />;
}
