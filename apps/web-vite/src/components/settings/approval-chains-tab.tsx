import { ApprovalsIllustration, AtelierEmptyState } from '@contractor-ops/ui';
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
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { tKey } from '../../i18n/typed-keys';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { ChainEditorDialogContainer } from './chain-editor-dialog-container.js';
import type { useApprovalChainsTab } from './hooks/use-approval-chains-tab.js';

type SettingsTranslateFn = (key: string, params?: Record<string, string | number>) => string;

function formatConditionSummary(conditions: unknown, t: SettingsTranslateFn): string {
  if (!(conditions && Array.isArray(conditions)) || conditions.length === 0) {
    return t('approvals.noConditions');
  }

  return conditions
    .map((c: { field: string; operator: string; value: string | number }) => {
      const opLabel = c.operator === 'gt' ? '>' : c.operator === 'lt' ? '<' : '=';
      const valueLabel = c.field === 'amount' ? `${c.value} PLN` : String(c.value);
      return `${c.field === 'amount' ? t('approvals.editor.fieldAmount') : t('approvals.editor.fieldContractorType')} ${opLabel} ${valueLabel}`;
    })
    .join(', ');
}

export type ApprovalChainsTabProps = ReturnType<typeof useApprovalChainsTab>;

type Chain = ApprovalChainsTabProps['chains'][number];

interface ChainCardProps {
  chain: Chain;
  t: ApprovalChainsTabProps['t'];
  tAria: ApprovalChainsTabProps['tAria'];
  isTogglePending: boolean;
  onToggleActive: (chain: Chain) => void;
  onEdit: (chain: Chain) => void;
  onRequestDelete: (id: string | null) => void;
}

function ChainCard({
  chain,
  t,
  tAria,
  isTogglePending,
  onToggleActive,
  onEdit,
  onRequestDelete,
}: ChainCardProps) {
  const handleToggle = useCallback(() => onToggleActive(chain), [onToggleActive, chain]);
  const handleEditClick = useCallback(() => onEdit(chain), [onEdit, chain]);
  const handleDeleteClick = useCallback(
    () => onRequestDelete(chain.id),
    [onRequestDelete, chain.id],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{chain.name}</span>
            {!!chain.isDefault && <Badge variant="secondary">{t('approvals.defaultBadge')}</Badge>}
          </div>
          <Switch
            checked={chain.isActive}
            onCheckedChange={handleToggle}
            disabled={isTogglePending}
            aria-label={tAria('toggleActive', { name: chain.name })}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {t('approvals.levelsCount', {
              n: Array.isArray(chain.stepsJson) ? chain.stepsJson.length : 0,
            })}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatConditionSummary(
              chain.conditionsJson,
              (key: string, params?: Record<string, string | number>) => tKey(t, key, params),
            )}
          </span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="ghost" size="sm" onClick={handleEditClick}>
          <Pencil className="me-1.5 size-3.5" />
          {t('approvals.edit')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={handleDeleteClick}>
          <Trash2 className="me-1.5 size-3.5" />
          {t('approvals.delete')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ApprovalChainsTab({
  t,
  tAria,
  chainsQuery,
  chains,
  editorOpen,
  setEditorOpen,
  editingChain,
  deletingChainId,
  setDeletingChainId,
  toggleActiveMutation,
  deleteMutation,
  handleToggleActive,
  handleEdit,
  handleCreate,
  handleDelete,
}: ApprovalChainsTabProps) {
  const handleAlertOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setDeletingChainId(null);
    },
    [setDeletingChainId],
  );

  const handleConfirmDelete = useCallback(() => {
    if (deletingChainId) handleDelete(deletingChainId);
  }, [deletingChainId, handleDelete]);

  if (chainsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1 h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-44" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Card key={`skel-${i}`}>
            <CardHeader>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <>
        <AtelierEmptyState
          variant="page"
          illustration={ApprovalsIllustration}
          heading={t('approvals.empty.heading')}
          body={t('approvals.empty.body')}
          primaryAction={{
            label: t('approvals.empty.cta'),
            onClick: handleCreate,
            icon: Plus,
          }}
          renderAction={renderEmptyStateAction}
        />
        <ChainEditorDialogContainer
          open={editorOpen}
          onOpenChange={setEditorOpen}
          chainData={editingChain}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">{t('approvals.heading')}</h3>
            <p className="text-sm text-muted-foreground">{t('approvals.description')}</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="me-1.5 size-4" />
            {t('approvals.createChain')}
          </Button>
        </div>

        {chains.map(chain => (
          <ChainCard
            key={chain.id}
            chain={chain}
            t={t}
            tAria={tAria}
            isTogglePending={toggleActiveMutation.isPending}
            onToggleActive={handleToggleActive}
            onEdit={handleEdit}
            onRequestDelete={setDeletingChainId}
          />
        ))}
      </div>

      <ChainEditorDialogContainer
        open={editorOpen}
        onOpenChange={setEditorOpen}
        chainData={editingChain}
      />

      <AlertDialog open={deletingChainId !== null} onOpenChange={handleAlertOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('approvals.deleteConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('approvals.deleteConfirm.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('approvals.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleConfirmDelete}>
              {t('approvals.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
