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
import type { Table } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { InvoiceAction } from '../actions.js';
import { getBulkInvoiceActions } from '../actions.js';
import type { InvoiceBulkActionsHandlers } from '../hooks/use-invoice-bulk-actions.js';
import type { InvoiceRow } from './columns.js';

interface DataTableBulkActionsProps {
  table: Table<InvoiceRow>;
  bulkActions: InvoiceBulkActionsHandlers;
  onComplete: () => void;
}

/**
 * Presentational bulk-action toolbar for the invoice list. Mutations wired
 * via `useInvoiceBulkActions`. Mirrors the contractor bulk-actions contract
 * (selection-driven container, deselect on completion, destructive confirm
 * dialog for terminal mutations).
 */
export function DataTableBulkActions({
  table,
  bulkActions,
  onComplete,
}: DataTableBulkActionsProps) {
  const t = useTranslations('Invoices.bulkActions');

  const [showVoidDialog, setShowVoidDialog] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const count = selectedIds.length;

  const actions = getBulkInvoiceActions();
  const actionByKey = new Map<string, InvoiceAction>(actions.map(a => [a.key, a]));
  const submitAction = actionByKey.get('submitForMatching');
  const voidAction = actionByKey.get('bulk.void');

  const SubmitIcon = submitAction?.icon;
  const VoidIcon = voidAction?.icon;

  const finish = useCallback(() => {
    onComplete();
    setShowVoidDialog(false);
  }, [onComplete]);

  const handleBulkSubmit = useCallback(() => {
    bulkActions.onBulkSubmitForMatching(selectedIds);
    finish();
  }, [bulkActions, selectedIds, finish]);

  const handleOpenVoid = useCallback(() => setShowVoidDialog(true), []);

  const handleConfirmVoid = useCallback(() => {
    bulkActions.onBulkVoid(selectedIds);
    finish();
  }, [bulkActions, selectedIds, finish]);

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        {!!submitAction && !!SubmitIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleBulkSubmit}
            disabled={bulkActions.isSubmittingForMatching}>
            {bulkActions.isSubmittingForMatching ? (
              <Loader2 className={`${iconSize.sm} animate-spin`} />
            ) : (
              <SubmitIcon className={iconSize.sm} />
            )}
            {tKey(t, submitAction.labelKey)}
          </Button>
        )}

        {!!voidAction && !!VoidIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
            onClick={handleOpenVoid}>
            <VoidIcon className={iconSize.sm} />
            {tKey(t, voidAction.labelKey)}
          </Button>
        )}
      </div>

      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('voidConfirmTitleBulk', { count })}</AlertDialogTitle>
            <AlertDialogDescription>{t('voidConfirmBodyBulk')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmVoid}
              disabled={bulkActions.isVoiding}
              variant="destructive">
              {bulkActions.isVoiding ? (
                <Loader2 className={`me-2 ${iconSize.md} animate-spin`} />
              ) : null}
              {t('voidConfirmCtaBulk', { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
