import { useBacsSubmitterForm } from '../hooks/use-bacs-submitter-form.js';
import { BacsSubmitterForm } from './bacs-submitter-form.js';

interface BacsSubmitterFormContainerProps {
  featureEnabled: boolean;
}

/**
 * Decision rule annotation — mutation-host container.
 *
 * Hook owns the save mutation, mask query, and the submitter-name sync
 * effect that bridges the BACS mask payload into the RHF reset cycle.
 * The view is a single render path: the only variant flag is
 * `isMasksLoading`, which gates a per-field skeleton label inside each
 * input row. Lifting that into the container would duplicate the form
 * (one render path per field permutation) without a meaningful gain —
 * the slot lives next to the live `register()` input it labels. Kept as
 * a passthrough so the form stays one cohesive RHF surface.
 */
export function BacsSubmitterFormContainer({ featureEnabled }: BacsSubmitterFormContainerProps) {
  const submitter = useBacsSubmitterForm();
  return <BacsSubmitterForm featureEnabled={featureEnabled} submitter={submitter} />;
}
