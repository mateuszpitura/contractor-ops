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
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useLeitwegIdDeleteDialog } from './hooks/use-leitweg-id-delete-dialog.js';
import type { useLeitwegIdDeleteDialog as UseLeitwegIdDeleteDialog } from './hooks/use-leitweg-id-delete-dialog.js';
import {
  LEITWEG_DELETE_BODY,
  LEITWEG_DELETE_BUTTON,
  LEITWEG_DELETE_HEADING,
} from './hooks/use-leitweg-id-delete-dialog.js';

interface LeitwegIdDeleteDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type LeitwegIdDeleteDialogViewProps = LeitwegIdDeleteDialogShellProps &
  ReturnType<typeof UseLeitwegIdDeleteDialog> & {
    tCommon: (key: string) => string;
  };

export function LeitwegIdDeleteDialogView({
  open,
  onOpenChange,
  tCommon,
  isPending,
  handleConfirm,
}: LeitwegIdDeleteDialogViewProps) {
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

interface LeitwegIdDeleteDialogProps extends LeitwegIdDeleteDialogShellProps {
  id: string;
  value: string;
}

export function LeitwegIdDeleteDialog({ open, onOpenChange, id, value }: LeitwegIdDeleteDialogProps) {
  const tCommon = useTranslations('Common');
  const dialog = useLeitwegIdDeleteDialog({ onOpenChange, id, value });

  return (
    <LeitwegIdDeleteDialogView open={open} onOpenChange={onOpenChange} tCommon={tCommon} {...dialog} />
  );
}
