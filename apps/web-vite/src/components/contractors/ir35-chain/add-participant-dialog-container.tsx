import { useAddIr35Participant } from '../hooks/use-ir35-chain.js';
import type { AddParticipantDialogProps } from './add-participant-dialog.js';
import { AddParticipantDialogView } from './add-participant-dialog.js';

// Decision: dialog host — open/onOpenChange gated by Ir35ChainPanel;
// useAddIr35Participant owns the upsertParticipant mutation.
export function AddParticipantDialogContainer(props: AddParticipantDialogProps) {
  const participant = useAddIr35Participant(props.engagementId, props.nextOrderIndex, open => {
    props.onOpenChange(open);
  });
  return <AddParticipantDialogView {...props} {...participant} />;
}
