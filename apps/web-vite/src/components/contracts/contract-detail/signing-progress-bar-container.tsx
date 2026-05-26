import { useSigningProgressBarPanel } from '../hooks/use-signing-progress-bar-panel.js';
import { SigningAuditTrail } from './signing-audit-trail.js';
import { SigningProgressBar } from './signing-progress-bar.js';
import { VoidEnvelopeDialog } from './void-envelope-dialog.js';

type SigningProgressBarContainerProps = {
  envelope: Parameters<typeof SigningProgressBar>[0]['envelope'];
};

// Decision: composes 3 sibling views (progress bar + audit trail + void dialog) and
// owns the dialog open/close state for both audit and void flows. The hook returns
// imperative handlers, not a variant flag, so there is no isLoading/isError branch
// to lift; the value-add of this container is the multi-child composition.
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
