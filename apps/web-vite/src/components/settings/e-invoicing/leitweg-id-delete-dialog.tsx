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
import { Loader2, Trash2 } from 'lucide-react';
import type { useLeitwegIdDeleteDialog } from './hooks/use-leitweg-id-delete-dialog.js';
import {
  LEITWEG_DELETE_BODY,
  LEITWEG_DELETE_BUTTON,
  LEITWEG_DELETE_HEADING,
} from './hooks/use-leitweg-id-delete-dialog.js';

interface LeitwegIdDeleteDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type LeitwegIdDeleteDialogProps = LeitwegIdDeleteDialogShellProps &
  ReturnType<typeof useLeitwegIdDeleteDialog> & {
    tCommon: (key: string) => string;
  };

export function LeitwegIdDeleteDialog({
  open,
  onOpenChange,
  tCommon,
  isPending,
  handleConfirm,
}: LeitwegIdDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4" />
            {LEITWEG_DELETE_HEADING}
          </AlertDialogTitle>
          <AlertDialogDescription>{LEITWEG_DELETE_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            data-testid="leitweg-delete-confirm"
            onClick={handleConfirm}>
            {isPending ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {LEITWEG_DELETE_BUTTON}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
