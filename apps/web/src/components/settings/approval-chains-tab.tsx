'use client';

import { ApprovalsIllustration, AtelierEmptyState } from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ChainData } from '@/components/settings/chain-editor-dialog';
import { ChainEditorDialog } from '@/components/settings/chain-editor-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApprovalChainsTab() {
  const t = useTranslations('Settings');
  const tAria = useTranslations('Common.aria');
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainData | null>(null);
  const [deletingChainId, setDeletingChainId] = useState<string | null>(null);

  // ---- Data fetching ----
  const chainsQuery = useQuery(trpc.approval.listChains.queryOptions());
  const chains = chainsQuery.data ?? [];

  // ---- Toggle active mutation ----
  const toggleActiveMutation = useMutation(
    trpc.approval.updateChain.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('approvals.toasts.saveFailed'));
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
      },
    }),
  );

  // ---- Delete mutation ----
  const deleteMutation = useMutation(
    trpc.approval.deleteChain.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvals.toasts.deleted'));
        queryClient.invalidateQueries({
          queryKey: trpc.approval.listChains.queryKey(),
        });
        setDeletingChainId(null);
      },
      onError: () => {
        toast.error(t('approvals.toasts.deleteFailed'));
      },
    }),
  );

  // ---- Handlers ----
  function handleToggleActive(chain: (typeof chains)[number]) {
    toggleActiveMutation.mutate({
      id: chain.id,
      name: chain.name,
      isDefault: chain.isDefault,
      stepsJson: chain.stepsJson as Parameters<typeof toggleActiveMutation.mutate>[0]['stepsJson'],
      isActive: !chain.isActive,
    });
  }

  function handleEdit(chain: (typeof chains)[number]) {
    setEditingChain({
      id: chain.id,
      name: chain.name,
      isDefault: chain.isDefault,
      isActive: chain.isActive,
      conditionsJson: chain.conditionsJson,
      stepsJson: chain.stepsJson,
    } as ChainData);
    setEditorOpen(true);
  }

  function handleCreate() {
    setEditingChain(null);
    setEditorOpen(true);
  }

  function handleDelete(chainId: string) {
    deleteMutation.mutate({ id: chainId });
  }

  // ---- Loading state ----
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

  // ---- Empty state ----
  if (chains.length === 0) {
    return (
      <>
        <AtelierEmptyState
          variant="subview"
          illustration={ApprovalsIllustration}
          heading={t('approvals.empty.heading')}
          body={t('approvals.empty.body')}
          primaryAction={{
            label: t('approvals.empty.cta'),
            onClick: handleCreate,
            icon: Plus,
          }}
          renderAction={action => (
            <Button onClick={action.onClick}>
              {action.icon ? <action.icon className="me-1.5 size-4" /> : null}
              {action.label}
            </Button>
          )}
        />
        <ChainEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          chainData={editingChain}
        />
      </>
    );
  }

  // ---- Populated state ----
  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">{t('approvals.heading')}</h3>
            <p className="text-sm text-muted-foreground">{t('approvals.description')}</p>
          </div>
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button onClick={handleCreate}>
            <Plus className="me-1.5 size-4" />
            {t('approvals.createChain')}
          </Button>
        </div>

        {/* Chain cards */}
        {chains.map(chain => (
          <Card key={chain.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{chain.name}</span>
                  {!!chain.isDefault && (
                    <Badge variant="secondary">{t('approvals.defaultBadge')}</Badge>
                  )}
                </div>
                <Switch
                  checked={chain.isActive}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onCheckedChange={() => handleToggleActive(chain)}
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
                    (key: string, params?: Record<string, string | number>) =>
                      t(key as Parameters<typeof t>[0], params),
                  )}
                </span>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
              <Button variant="ghost" size="sm" onClick={() => handleEdit(chain)}>
                <Pencil className="me-1.5 size-3.5" />
                {t('approvals.edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setDeletingChainId(chain.id)}>
                <Trash2 className="me-1.5 size-3.5" />
                {t('approvals.delete')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Chain editor dialog */}
      <ChainEditorDialog open={editorOpen} onOpenChange={setEditorOpen} chainData={editingChain} />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deletingChainId !== null}
        // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
        onOpenChange={open => {
          if (!open) setDeletingChainId(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('approvals.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('approvals.deleteConfirm.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('approvals.deleteConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                if (deletingChainId) handleDelete(deletingChainId);
              }}>
              {t('approvals.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
