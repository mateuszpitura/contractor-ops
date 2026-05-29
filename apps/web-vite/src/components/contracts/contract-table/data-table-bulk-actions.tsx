import { iconSize } from '@contractor-ops/ui';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { Table } from '@tanstack/react-table';
import { Loader2, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ContractAction } from '../actions.js';
import { getBulkContractActions } from '../actions.js';
import type { ContractBulkActionsHandlers } from '../hooks/use-contract-bulk-actions.js';
import type { ContractRow } from './columns.js';

interface DataTableBulkActionsProps {
  table: Table<ContractRow>;
  bulkActions: ContractBulkActionsHandlers;
  onComplete: () => void;
}

/**
 * Presentational bulk action toolbar. Mutations wired via `useContractBulkActions`.
 */
export function DataTableBulkActions({
  table,
  bulkActions,
  onComplete,
}: DataTableBulkActionsProps) {
  const t = useTranslations('Contracts.bulkActions');
  const tc = useTranslations('Contracts');
  const td = useTranslations('Contracts.terminate');

  const [showTerminateDialog, setShowTerminateDialog] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const count = selectedIds.length;

  const actions = getBulkContractActions();
  const actionByKey = new Map<string, ContractAction>(actions.map(a => [a.key, a]));
  const exportAction = actionByKey.get('bulk.export');
  const terminateAction = actionByKey.get('bulk.terminate');

  const ExportIcon = exportAction?.icon;
  const TerminateIcon = terminateAction?.icon;

  const finish = useCallback(() => {
    onComplete();
    setShowTerminateDialog(false);
  }, [onComplete]);

  const renderExportTrigger = useCallback(
    (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
        {!!ExportIcon && <ExportIcon className={iconSize.sm} />}
        {exportAction ? tKey(t, exportAction.labelKey) : null}
      </Button>
    ),
    [ExportIcon, exportAction, t],
  );

  const handleExportComingSoon = useCallback(() => {
    toast.info(tc('exportComingSoon'));
  }, [tc]);

  const openTerminateDialog = useCallback(() => setShowTerminateDialog(true), []);

  const handleConfirmTerminate = useCallback(() => {
    bulkActions.onBulkTerminate(selectedIds);
    finish();
  }, [bulkActions, selectedIds, finish]);

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        {!!exportAction && !!ExportIcon && (
          <DropdownMenu>
            <DropdownMenuTrigger render={renderExportTrigger} />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleExportComingSoon}>{t('exportCsv')}</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportComingSoon}>
                {t('exportXlsx')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!!terminateAction && !!TerminateIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
            onClick={openTerminateDialog}>
            <TerminateIcon className={iconSize.sm} />
            {tKey(t, terminateAction.labelKey)}
          </Button>
        )}
      </div>

      <AlertDialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {td('titleBulk', { count })}
            </AlertDialogTitle>
            <AlertDialogDescription>{td('bodyBulk')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTerminate}
              disabled={bulkActions.isTerminating}
              variant="destructive">
              {bulkActions.isTerminating ? (
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
