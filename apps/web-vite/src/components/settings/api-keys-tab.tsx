import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { FeatureGate } from '../layout/feature-gate';
import type { EditTarget, RevokeTarget, RotateTarget } from './api-keys/data-table.js';
import { ApiKeysDataTable } from './api-keys/data-table.js';
import type { KeyDetailRow } from './api-keys/key-detail-drawer.js';
import { KeyDetailDrawer } from './api-keys/key-detail-drawer.js';
import { CreateKeyDialog } from './create-api-key-dialog.js';
import { EditKeyDialog } from './edit-api-key-dialog.js';
import { useApiKeysTab } from './hooks/use-api-keys-tab.js';
import { RevokeKeyDialog } from './revoke-api-key-dialog.js';
import { RotateKeyDialog } from './rotate-api-key-dialog.js';

export type ApiKeysTabViewProps = ReturnType<typeof useApiKeysTab>;

export function ApiKeysTab() {
  const tab = useApiKeysTab();
  return <ApiKeysTabView {...tab} />;
}

export function ApiKeysTabView({ t, keys, isLoading }: ApiKeysTabViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [rotateTarget, setRotateTarget] = useState<RotateTarget | null>(null);
  const [detailTarget, setDetailTarget] = useState<KeyDetailRow | null>(null);

  const openCreate = useCallback(() => setCreateOpen(true), []);
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('description')}</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="me-1.5 size-4" />
            {t('createKeyButton')}
          </Button>
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
