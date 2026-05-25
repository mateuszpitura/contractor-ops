import { useOtherClientAttestation } from '../hooks/use-other-client-attestation.js';
import type { OtherClientAttestationFormProps } from './other-client-attestation-form.js';
import { OtherClientAttestationFormView } from './other-client-attestation-form.js';

// Decision: render gated externally by parent (engagement detail mounts the
// form only for DE engagements). Container's job is to keep the attestation
// upsert mutation out of the view.
export function OtherClientAttestationFormContainer(props: OtherClientAttestationFormProps) {
  const attestation = useOtherClientAttestation(props.engagementId);
  return <OtherClientAttestationFormView {...props} {...attestation} />;
}
