// Destructive deregister-Peppol-participant confirmation dialog. Uses
// shadcn AlertDialog per UI-SPEC §Destructive confirmations.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Loader2, Unlink } from 'lucide-react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { usePeppolParticipantDeregisterDialog as UsePeppolParticipantDeregisterDialog } from './hooks/use-peppol-participant-deregister-dialog.js';
import { usePeppolParticipantDeregisterDialog } from './hooks/use-peppol-participant-deregister-dialog.js';

const DEREGISTER_HEADING = 'Deregister from Peppol?';
const DEREGISTER_BODY =
  "You won't be able to send e-invoices to UK public sector via Peppol until you re-register. Invoices already transmitted keep their delivery record.";

interface PeppolParticipantDeregisterDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type PeppolParticipantDeregisterDialogViewProps =
  PeppolParticipantDeregisterDialogShellProps &
    ReturnType<typeof UsePeppolParticipantDeregisterDialog> & {
      tCommon: (key: string) => string;
    };

export function PeppolParticipantDeregisterDialogView({
  open,
  onOpenChange,
  tCommon,
  t,
  isPending,
  handleConfirm,
}: PeppolParticipantDeregisterDialogViewProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Unlink className="size-4" />
            {DEREGISTER_HEADING}
          </AlertDialogTitle>
          <AlertDialogDescription>{DEREGISTER_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleConfirm}>
            {isPending ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {t('deregisterButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PeppolParticipantDeregisterDialog({
  open,
  onOpenChange,
}: PeppolParticipantDeregisterDialogShellProps) {
  const tCommon = useTranslations('Common');
  const dialog = usePeppolParticipantDeregisterDialog({ onOpenChange });

  return (
    <PeppolParticipantDeregisterDialogView
      open={open}
      onOpenChange={onOpenChange}
      tCommon={tCommon}
      {...dialog}
    />
  );
}
