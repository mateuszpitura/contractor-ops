'use client';

import { iconSize } from '@contractor-ops/ui';
import type { Table } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useResourceMutation } from '@/hooks/use-resource-mutation';
import { trpc } from '@/trpc/init';
import type { ContractAction } from '../actions';
import { getBulkContractActions } from '../actions';
import type { ContractRow } from './columns';

interface DataTableBulkActionsProps {
  table: Table<ContractRow>;
}

/**
 * Bulk action toolbar shown when 1+ rows are selected.
 *
 * Inventory of actions is sourced from `getBulkContractActions()` so the
 * toolbar cannot drift from the detail-header or row context menu. Each
 * action's `key` is matched to a bespoke UI control (dropdown / dialog /
 * button) — the registry supplies label, icon and variant, the consumer
 * supplies the interaction shape.
 */
export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const t = useTranslations('Contracts.bulkActions');
  const tc = useTranslations('Contracts');
  const td = useTranslations('Contracts.terminate');

  const [showTerminateDialog, setShowTerminateDialog] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const count = selectedIds.length;

  // ---- Registry lookups ---------------------------------------------------
  const actions = getBulkContractActions();
  const actionByKey = new Map<string, ContractAction>(actions.map(a => [a.key, a]));
  const exportAction = actionByKey.get('bulk.export');
  const terminateAction = actionByKey.get('bulk.terminate');

  const ExportIcon = exportAction?.icon;
  const TerminateIcon = terminateAction?.icon;

  // Match the original broad invalidation scope so any contract-scoped query
  // (list, getById, summaries, etc.) gets refreshed after a bulk transition.
  const contractPrefixKey = ['contract'] as const;
  const deselect = () => table.toggleAllPageRowsSelected(false);

  // ---- Mutations (canonical pattern via useResourceMutation) --------------
  // Note: the server returns `{ updated, failed }`; if rows are filtered out
  // server-side the toast will still report the selection size. This is the
  // same trade-off accepted in the contractors bulkArchive consumer.
  const bulkTerminateMutation = useResourceMutation(
    trpc.contract.bulkTransition.mutationOptions(),
    {
      invalidate: [contractPrefixKey],
      successMessage: tc('terminated', { count }),
      errorMessage: tc('error.loadFailed'),
      onClose: () => {
        deselect();
        setShowTerminateDialog(false);
      },
    },
  );

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        {/* Export — placeholder; contract export router is not yet implemented */}
        {!!exportAction && !!ExportIcon && (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                  <ExportIcon className={iconSize.sm} />
                  {t(exportAction.labelKey)}
                </Button>
              )}
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => {
                  toast.info(tc('exportComingSoon'));
                }}>
                {t('exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => {
                  toast.info(tc('exportComingSoon'));
                }}>
                {t('exportXlsx')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Terminate */}
        {!!terminateAction && !!TerminateIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setShowTerminateDialog(true)}>
            <TerminateIcon className={iconSize.sm} />
            {t(terminateAction.labelKey)}
          </Button>
        )}
      </div>

      {/* Terminate confirmation dialog */}
      <AlertDialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{td('titleBulk', { count })}</AlertDialogTitle>
            <AlertDialogDescription>{td('bodyBulk')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() =>
                bulkTerminateMutation.mutate({
                  ids: selectedIds,
                  targetStatus: 'TERMINATED',
                })
              }
              disabled={bulkTerminateMutation.isPending}
              variant="destructive">
              {bulkTerminateMutation.isPending ? (
                <Loader2 className={`me-2 ${iconSize.md} animate-spin`} />
              ) : null}
              {td('ctaBulk', { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
