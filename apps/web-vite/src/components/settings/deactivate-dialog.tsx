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
import type { useDeactivateDialog as UseDeactivateDialog } from './hooks/use-deactivate-dialog.js';
import { useDeactivateDialog } from './hooks/use-deactivate-dialog.js';

interface DeactivateDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export type DeactivateDialogViewProps = DeactivateDialogShellProps &
  ReturnType<typeof UseDeactivateDialog>;

export function DeactivateDialogView({
  open,
  onOpenChange,
  userName,
  t,
  isPending,
  handleConfirm,
}: DeactivateDialogViewProps) {
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
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
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

export function DeactivateDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: DeactivateDialogShellProps) {
  const dialog = useDeactivateDialog({ open, onOpenChange, userId, userName });
  return (
    <DeactivateDialogView
      open={open}
      onOpenChange={onOpenChange}
      userId={userId}
      userName={userName}
      {...dialog}
    />
  );
}
