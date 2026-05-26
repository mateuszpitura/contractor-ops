import { useOtherClientAttestation } from '../hooks/use-other-client-attestation.js';
import type { OtherClientAttestationFormProps } from './other-client-attestation-form.js';
import { OtherClientAttestationFormView } from './other-client-attestation-form.js';

// Decision: form host — view owns react-hook-form; useOtherClientAttestation
// supplies the upsert mutation. Engagement detail mounts this only for DE.
export function OtherClientAttestationFormContainer(props: OtherClientAttestationFormProps) {
  const attestation = useOtherClientAttestation(props.engagementId);
  return <OtherClientAttestationFormView {...props} {...attestation} />;
}
