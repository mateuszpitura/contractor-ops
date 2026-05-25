// Decision: side-effect setup — owns local resetNonce state to force-remount the form after each
// successful register, wired through the hook's onReset callback. Dialog rendered conditionally by
// PeppolParticipantCard via open prop.
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePeppolParticipantRegisterDialog } from './hooks/use-peppol-participant-register-dialog.js';
import { PeppolParticipantRegisterDialog } from './peppol-participant-register-dialog.js';

interface PeppolParticipantRegisterDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PeppolParticipantRegisterDialogContainer({
  open,
  onOpenChange,
}: PeppolParticipantRegisterDialogContainerProps) {
  const tCommon = useTranslations('Common');
  const [resetNonce, setResetNonce] = useState(0);
  const dialog = usePeppolParticipantRegisterDialog({
    onOpenChange,
    onReset: () => setResetNonce(n => n + 1),
  });

  return (
    <PeppolParticipantRegisterDialog
      open={open}
      onOpenChange={onOpenChange}
      tCommon={tCommon}
      resetNonce={resetNonce}
      {...dialog}
    />
  );
}
