/**
 * Decisive container: variant pick on the `open` flag returned by
 * `useTosReacceptance`. When the user has accepted (or the mutation
 * closes the modal post-success) the container renders `null` so the
 * `TosReacceptanceModalView` stays single-path — always-open dialog —
 * and the open/closed decision lives here, not in the view.
 */

import { useTosReacceptance } from './legal/hooks/use-tos-reacceptance.js';
import { TosReacceptanceModalView } from './tos-reacceptance-modal.js';

interface TosReacceptanceModalContainerProps {
  currentVersion: string;
}

export function TosReacceptanceModalContainer({
  currentVersion,
}: TosReacceptanceModalContainerProps) {
  const { open, isPending, onAccept } = useTosReacceptance();
  if (!open) return null;
  return (
    <TosReacceptanceModalView
      currentVersion={currentVersion}
      isPending={isPending}
      onAccept={onAccept}
    />
  );
}
