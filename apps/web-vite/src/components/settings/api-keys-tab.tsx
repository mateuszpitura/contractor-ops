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
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Check, ClipboardCopy, FlaskConical, Loader2, Plus, ShieldAlert } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useState } from 'react';
import { FeatureGate } from '../layout/feature-gate';
import type { EditTarget, RevokeTarget, RotateTarget } from './api-keys/data-table.js';
import { ApiKeysDataTable } from './api-keys/data-table.js';
import type { KeyDetailRow } from './api-keys/key-detail-drawer.js';
import { KeyDetailDrawer } from './api-keys/key-detail-drawer.js';
import { CreateKeyDialog } from './create-api-key-dialog.js';
import { EditKeyDialog } from './edit-api-key-dialog.js';
import { useApiKeysTab, useCreateSandboxKeyDialog } from './hooks/use-api-keys-tab.js';
import { MarketplaceTab } from './marketplace-tab.js';
import { RevokeKeyDialog } from './revoke-api-key-dialog.js';
import { RotateKeyDialog } from './rotate-api-key-dialog.js';

export type ApiKeysTabViewProps = ReturnType<typeof useApiKeysTab>;

export function ApiKeysTab() {
  const tab = useApiKeysTab();
  return (
    <div className="space-y-10">
      <ApiKeysTabView {...tab} />
      <MarketplaceTab />
    </div>
  );
}

export function ApiKeysTabView({ t, keys, isLoading }: ApiKeysTabViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [rotateTarget, setRotateTarget] = useState<RotateTarget | null>(null);
  const [detailTarget, setDetailTarget] = useState<KeyDetailRow | null>(null);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const openSandbox = useCallback(() => setSandboxOpen(true), []);
  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditTarget(null);
  }, []);
  const handleRevokeOpenChange = useCallback((open: boolean) => {
    if (!open) setRevokeTarget(null);
  }, []);
  const handleRotateOpenChange = useCallback((open: boolean) => {
    if (!open) setRotateTarget(null);
  }, []);
  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailTarget(null);
  }, []);

  return (
    <FeatureGate requiredTier="Enterprise" featureName="API Keys">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex items-center gap-2">
            <FeatureGate flag="module.api-sandbox">
              <Button size="sm" variant="outline" onClick={openSandbox}>
                <FlaskConical className="me-1.5 size-4" />
                {t('sandbox.createButton')}
              </Button>
            </FeatureGate>
            <Button size="sm" onClick={openCreate}>
              <Plus className="me-1.5 size-4" />
              {t('createKeyButton')}
            </Button>
          </div>
        </div>

        <ApiKeysDataTable
          t={t}
          keys={keys ?? []}
          isLoading={isLoading}
          onCreate={openCreate}
          onEdit={setEditTarget}
          onRevoke={setRevokeTarget}
          onRotate={setRotateTarget}
          onViewDetails={setDetailTarget}
        />

        <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} />

        {sandboxOpen && <SandboxKeyDialog open={sandboxOpen} onOpenChange={setSandboxOpen} />}

        {editTarget != null && (
          <EditKeyDialog
            keyId={editTarget.id}
            initialName={editTarget.name}
            initialScopes={editTarget.scopes}
            open={!!editTarget}
            onOpenChange={handleEditOpenChange}
          />
        )}

        {revokeTarget != null && (
          <RevokeKeyDialog
            keyId={revokeTarget.id}
            keyName={revokeTarget.name}
            open={!!revokeTarget}
            onOpenChange={handleRevokeOpenChange}
          />
        )}

        {rotateTarget != null && (
          <RotateKeyDialog
            keyId={rotateTarget.id}
            keyName={rotateTarget.name}
            open={!!rotateTarget}
            onOpenChange={handleRotateOpenChange}
          />
        )}

        {detailTarget != null && (
          <KeyDetailDrawer
            apiKey={detailTarget}
            open={!!detailTarget}
            onOpenChange={handleDetailOpenChange}
          />
        )}
      </div>
    </FeatureGate>
  );
}

function SandboxKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    t,
    tCommon,
    id,
    name,
    setName,
    sandboxKey,
    copied,
    createMutation,
    handleCreate,
    handleCopy,
    handleClose,
  } = useCreateSandboxKeyDialog({ onOpenChange });

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    [setName],
  );

  if (sandboxKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="size-4" />
              {t('createdTitle')}
            </DialogTitle>
            <DialogDescription>{t('createdDescription')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-xs">{sandboxKey}</code>
              <Button variant="ghost" size="icon-sm" onClick={handleCopy} aria-label={t('copyKey')}>
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">{t('orgNote')}</p>
            <p className="text-xs font-medium">{t('limitNote')}</p>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t('securityWarning')}</span>
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose render={<Button />}>{t('doneButton')}</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4" />
            {t('dialogTitle')}
          </DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-sandbox-name`}>{t('nameLabel')}</Label>
            <Input
              id={`${id}-sandbox-name`}
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={handleNameChange}
              autoFocus
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tCommon('cancel')}</DialogClose>
          <Button onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
            {!!createMutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
