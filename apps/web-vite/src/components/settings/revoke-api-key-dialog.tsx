import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Loader2, Trash2 } from 'lucide-react';
import type { useRevokeKeyDialog as UseRevokeKeyDialog } from './hooks/use-api-keys-tab.js';
import { useRevokeKeyDialog } from './hooks/use-api-keys-tab.js';

interface RevokeKeyDialogShellProps {
  keyId: string;
  keyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type RevokeKeyDialogViewProps = RevokeKeyDialogShellProps &
  ReturnType<typeof UseRevokeKeyDialog>;

export function RevokeKeyDialogView({
  keyName,
  open,
  onOpenChange,
  t,
  tCommon,
  isPending,
  handleRevoke,
}: RevokeKeyDialogViewProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <Trash2 className="size-5 text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('revokeDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('revokeDialog.description', { name: keyName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleRevoke} disabled={isPending}>
            {!!isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('revokeDialog.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RevokeKeyDialog({ keyId, keyName, open, onOpenChange }: RevokeKeyDialogShellProps) {
  const dialog = useRevokeKeyDialog({ keyId, keyName, onOpenChange });
  return (
    <RevokeKeyDialogView
      keyId={keyId}
      keyName={keyName}
      open={open}
      onOpenChange={onOpenChange}
      {...dialog}
    />
  );
}
