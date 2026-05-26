import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Loader2, UserMinus, UserX } from 'lucide-react';
import type { useDeactivateDialog } from './hooks/use-deactivate-dialog.js';

interface DeactivateDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export type DeactivateDialogProps = DeactivateDialogBaseProps &
  ReturnType<typeof useDeactivateDialog>;

/**
 * Confirmation dialog for deactivating a team member.
 * Uses AlertDialog for destructive action confirmation pattern.
 * Calls trpc.user.deactivate on confirm, refreshes the user list on success.
 */
export function DeactivateDialog({
  open,
  onOpenChange,
  userName,
  t,
  isPending,
  handleConfirm,
}: DeactivateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserMinus className="size-4" />
            {t('title', { userName })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleConfirm}
            disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('deactivating')}
              </>
            ) : (
              <>
                <UserX className="h-4 w-4" />
                {t('cta')}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
