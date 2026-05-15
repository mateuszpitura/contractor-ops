// apps/web/src/components/settings/e-invoicing/leitweg-id-delete-dialog.tsx
//
// Phase 61 · Plan 61-07 — Destructive delete-Leitweg-ID confirmation dialog.
// Uses shadcn AlertDialog with UI-SPEC locked copy.

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
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

interface LeitwegIdDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  value: string;
}

const DELETE_HEADING = 'Delete this Leitweg-ID?';
const DELETE_BODY =
  "This will remove the ID from the contractor / contract. If you re-register it later, the ID itself doesn't change — only this record. Existing invoices already using it keep their reference.";
const DELETE_BUTTON = 'Delete Leitweg-ID';

export function LeitwegIdDeleteDialog({
  open,
  onOpenChange,
  id,
  value,
}: LeitwegIdDeleteDialogProps) {
  const tErrors = useTranslations('EInvoice.Errors');
  const tCommon = useTranslations('Common');
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.leitwegId.delete.mutationOptions({
      onSuccess: () => {
        toast.success(`${DELETE_BUTTON}: ${value}`);
        queryClient.invalidateQueries({ queryKey: trpc.leitwegId.list.queryKey() });
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
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4" />
            {DELETE_HEADING}
          </AlertDialogTitle>
          <AlertDialogDescription>{DELETE_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteMutation.isPending}
            data-testid="leitweg-delete-confirm"
            onClick={() => {
              (deleteMutation.mutate as (input: { id: string }) => void)({ id });
            }}>
            {deleteMutation.isPending ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {DELETE_BUTTON}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
