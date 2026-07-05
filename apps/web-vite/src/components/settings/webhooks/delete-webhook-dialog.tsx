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
import { Loader2 } from 'lucide-react';
import { useDeleteWebhookDialog } from './hooks/use-webhooks-tab.js';

interface DeleteWebhookDialogProps {
  subscriptionId: string;
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteWebhookDialog({
  subscriptionId,
  url,
  open,
  onOpenChange,
}: DeleteWebhookDialogProps) {
  const { t, tCommon, isPending, handleDelete } = useDeleteWebhookDialog({
    subscriptionId,
    onOpenChange,
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialog.description', { url })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {!!isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('deleteDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
