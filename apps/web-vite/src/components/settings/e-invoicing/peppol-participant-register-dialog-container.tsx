import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePeppolParticipantRegisterDialog } from './hooks/use-peppol-participant-register-dialog.js';
import { PeppolParticipantRegisterDialog } from './peppol-participant-register-dialog.js';

interface PeppolParticipantRegisterDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: side-effect setup — owns local resetNonce to force-remount the form after
// each successful register via the hook's onReset; open prop gated by PeppolParticipantCard.
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
