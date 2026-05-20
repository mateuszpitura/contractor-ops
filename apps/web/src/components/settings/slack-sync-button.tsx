'use client';

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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// SlackSyncButton
// ---------------------------------------------------------------------------

/**
 * "Sync users" CTA for the Slack integration. Wires
 * `integration.syncUsers` — a bulk pull from the connected Slack workspace
 * that may overwrite existing user mappings.
 *
 * Gated behind an AlertDialog confirmation per repo convention for
 * destructive/expensive mutations.
 */
export function SlackSyncButton() {
  const t = useTranslations('Settings.integrations.userMapping.syncUsers');
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const syncMutation = useMutation(
    trpc.integration.syncUsers.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.success'));
        // Refresh the Slack user mapping table so newly-synced links surface
        // immediately.
        queryClient.invalidateQueries({
          queryKey: trpc.integration.listUserMappings.queryKey(),
        });
      },
      onError: err => {
        toast.error(err.message);
      },
    }),
  );

  const handleOpenConfirm = useCallback(() => setConfirmOpen(true), []);
  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    syncMutation.mutate();
  }, [syncMutation]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenConfirm}
        disabled={syncMutation.isPending}
        data-slot="slack-sync-users-cta">
        <RefreshCw
          className={`me-2 size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {syncMutation.isPending ? t('syncing') : t('cta')}
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
