// apps/web/src/components/settings/e-invoicing/peppol-participant-deregister-dialog.tsx
//
// Phase 61 · Plan 61-07 — Destructive deregister-Peppol-participant
// confirmation dialog. Uses shadcn AlertDialog per UI-SPEC §Destructive
// confirmations.

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { trpc } from '@/trpc/init';

interface PeppolParticipantDeregisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEREGISTER_HEADING = 'Deregister from Peppol?';
const DEREGISTER_BODY =
  "You won't be able to send e-invoices to UK public sector via Peppol until you re-register. Invoices already transmitted keep their delivery record.";

export function PeppolParticipantDeregisterDialog({
  open,
  onOpenChange,
}: PeppolParticipantDeregisterDialogProps) {
  const t = useTranslations('EInvoice.PeppolDialog');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('EInvoice.Errors');
  const queryClient = useQueryClient();

  const disconnectMutation = useMutation(
    trpc.peppol.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t('deregisterButton'));
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.listParticipants.queryKey(),
        });
        queryClient.invalidateQueries({ queryKey: trpc.peppol.getStatus.queryKey() });
        onOpenChange(false);
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || tErrors('Generic'));
      },
    }),
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{DEREGISTER_HEADING}</AlertDialogTitle>
          <AlertDialogDescription>{DEREGISTER_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={disconnectMutation.isPending}
            onClick={() => {
              (disconnectMutation.mutate as () => void)();
            }}>
            {disconnectMutation.isPending ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {t('deregisterButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
