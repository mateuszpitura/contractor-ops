import { useAddIr35Participant } from '../hooks/use-ir35-chain.js';
import type { AddParticipantDialogProps } from './add-participant-dialog.js';
import { AddParticipantDialogView } from './add-participant-dialog.js';

// Decision: render gated externally by parent (ir35-chain-panel owns open state).
// Container's job is to keep the upsertParticipant mutation out of the view.
export function AddParticipantDialogContainer(props: AddParticipantDialogProps) {
  const participant = useAddIr35Participant(props.engagementId, props.nextOrderIndex, open => {
    props.onOpenChange(open);
  });
  return <AddParticipantDialogView {...props} {...participant} />;
}
