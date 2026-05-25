// Decision: confirmation dialog rendered conditionally by PeppolParticipantCard via open prop.
// Container scopes the deregister mutation lifecycle.
import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePeppolParticipantDeregisterDialog } from './hooks/use-peppol-participant-deregister-dialog.js';
import { PeppolParticipantDeregisterDialog } from './peppol-participant-deregister-dialog.js';

interface PeppolParticipantDeregisterDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PeppolParticipantDeregisterDialogContainer({
  open,
  onOpenChange,
}: PeppolParticipantDeregisterDialogContainerProps) {
  const tCommon = useTranslations('Common');
  const dialog = usePeppolParticipantDeregisterDialog({ onOpenChange });

  return (
    <PeppolParticipantDeregisterDialog
      open={open}
      onOpenChange={onOpenChange}
      tCommon={tCommon}
      {...dialog}
    />
  );
}
