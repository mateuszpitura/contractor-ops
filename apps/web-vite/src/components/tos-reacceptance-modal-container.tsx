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
