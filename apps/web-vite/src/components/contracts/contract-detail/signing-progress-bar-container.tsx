import { useSigningProgressBarPanel } from '../hooks/use-signing-progress-bar-panel.js';
import { SigningAuditTrail } from './signing-audit-trail.js';
import { SigningProgressBar } from './signing-progress-bar.js';
import { VoidEnvelopeDialog } from './void-envelope-dialog.js';

type SigningProgressBarContainerProps = {
  envelope: Parameters<typeof SigningProgressBar>[0]['envelope'];
};

// Decision: composition — bundles SigningProgressBar + SigningAuditTrail
// + VoidEnvelopeDialog as siblings sharing useSigningProgressBarPanel state.
export function SigningProgressBarContainer({ envelope }: SigningProgressBarContainerProps) {
  const panel = useSigningProgressBarPanel(envelope.id);

  return (
    <>
      <SigningProgressBar
        envelope={envelope}
        signing={panel.signing}
        auditOpen={panel.auditOpen}
        onAuditOpenChange={panel.setAuditOpen}
        onVoidOpen={panel.openVoid}
      />
      <SigningAuditTrail
        open={panel.auditOpen}
        onOpenChange={panel.setAuditOpen}
        audit={panel.audit}
      />
      <VoidEnvelopeDialog
        open={panel.voidOpen}
        onOpenChange={panel.setVoidOpen}
        voidDialog={panel.voidDialog}
      />
    </>
  );
}
