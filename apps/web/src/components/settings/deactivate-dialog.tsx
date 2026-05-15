'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserMinus, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';

interface DeactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

/**
 * Confirmation dialog for deactivating a team member.
 * Uses AlertDialog for destructive action confirmation pattern.
 * Calls trpc.user.deactivate on confirm, refreshes the user list on success.
 */
export function DeactivateDialog({ open, onOpenChange, userId, userName }: DeactivateDialogProps) {
  const t = useTranslations('Users.deactivateDialog');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();

  const deactivateMutation = useMutation(
    trpc.user.deactivate.mutationOptions({
      onSuccess: () => {
        toast.success(t('successToast', { userName }));
        queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('deactivateFailed'));
      },
    }),
  );

  const handleConfirm = () => {
    deactivateMutation.mutate({ userId });
  };

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
          <AlertDialogCancel disabled={deactivateMutation.isPending}>
            {t('cancel')}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleConfirm}
            disabled={deactivateMutation.isPending}>
            {deactivateMutation.isPending ? (
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
