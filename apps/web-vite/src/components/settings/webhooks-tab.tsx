import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { KeyRound, Plus, ShieldAlert } from 'lucide-react';
import { useCallback, useState } from 'react';
import { CreateWebhookDialog } from './webhooks/create-webhook-dialog.js';
import type { WebhookRow } from './webhooks/data-table.js';
import { WebhooksDataTable } from './webhooks/data-table.js';
import { DeleteWebhookDialog } from './webhooks/delete-webhook-dialog.js';
import { useWebhookRowActions, useWebhooksTab } from './webhooks/hooks/use-webhooks-tab.js';

export type WebhooksTabViewProps = ReturnType<typeof useWebhooksTab> & {
  actions: ReturnType<typeof useWebhookRowActions>;
};

export function WebhooksTab() {
  const tab = useWebhooksTab();
  const actions = useWebhookRowActions();
  return <WebhooksTabView {...tab} actions={actions} />;
}

export function WebhooksTabView({ t, subscriptions, isLoading, actions }: WebhooksTabViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRow | null>(null);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const handleDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) setDeleteTarget(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="me-1.5 size-4" />
          {t('createButton')}
        </Button>
      </div>

      <WebhooksDataTable
        t={t}
        subscriptions={(subscriptions ?? []) as WebhookRow[]}
        isLoading={isLoading}
        onCreate={openCreate}
        onTestFire={actions.testFire}
        onRotateSecret={actions.rotateSecret}
        onDelete={setDeleteTarget}
      />

      <CreateWebhookDialog open={createOpen} onOpenChange={setCreateOpen} />

      {deleteTarget != null && (
        <DeleteWebhookDialog
          subscriptionId={deleteTarget.id}
          url={deleteTarget.url}
          open={!!deleteTarget}
          onOpenChange={handleDeleteOpenChange}
        />
      )}

      <Dialog open={actions.rotatedSecret != null} onOpenChange={actions.clearRotatedSecret}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              {t('rotatedDialog.title')}
            </DialogTitle>
            <DialogDescription>{t('rotatedDialog.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <code className="block break-all rounded-lg border bg-muted/50 p-3 font-mono text-xs">
              {actions.rotatedSecret}
            </code>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t('createdDialog.securityWarning')}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button />}>{t('createdDialog.done')}</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
