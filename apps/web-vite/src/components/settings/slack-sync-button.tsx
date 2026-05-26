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
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { RefreshCw } from 'lucide-react';
import type { useSlackSyncButton } from './hooks/use-slack-sync-button.js';

export type SlackSyncButtonProps = ReturnType<typeof useSlackSyncButton>;

/**
 * "Sync users" CTA for the Slack integration. Wires
 * `integration.syncUsers` — a bulk pull from the connected Slack workspace
 * that may overwrite existing user mappings.
 *
 * Gated behind an AlertDialog confirmation per repo convention for
 * destructive/expensive mutations.
 */
export function SlackSyncButton({
  t,
  confirmOpen,
  setConfirmOpen,
  isPending,
  handleOpenConfirm,
  handleConfirm,
}: SlackSyncButtonProps) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenConfirm}
        disabled={isPending}
        data-slot="slack-sync-users-cta">
        <RefreshCw
          className={`me-2 size-4 ${isPending ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {isPending ? t('syncing') : t('cta')}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
