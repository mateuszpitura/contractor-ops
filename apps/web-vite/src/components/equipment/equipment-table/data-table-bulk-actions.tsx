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
import { Archive, Download, Loader2, UserMinus } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { EquipmentBulkActionsHandlers } from '../hooks/use-equipment-bulk-actions.js';
import type { EquipmentRow } from './equipment-columns.js';

interface DataTableBulkActionsProps {
  selectedRows: EquipmentRow[];
  bulkActions: EquipmentBulkActionsHandlers;
  onComplete: () => void;
}

/**
 * Bulk action toolbar for the equipment table. Receives the selected row
 * originals directly from the canonical `DataTable` host. Mutations are
 * wired via `useEquipmentBulkActions`.
 */
export function DataTableBulkActions({
  selectedRows,
  bulkActions,
  onComplete,
}: DataTableBulkActionsProps) {
  const t = useTranslations('Equipment.bulkActions');

  const [showRetireDialog, setShowRetireDialog] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);

  const selectedIds = selectedRows.map(row => row.id);
  const selectedData = selectedRows;
  const count = selectedIds.length;

  const finish = useCallback(() => {
    onComplete();
    setShowRetireDialog(false);
    setShowUnassignDialog(false);
  }, [onComplete]);

  const handleConfirmRetire = useCallback(async () => {
    await bulkActions.onBulkRetire(selectedIds);
    finish();
  }, [bulkActions, selectedIds, finish]);

  const handleConfirmUnassign = useCallback(async () => {
    await bulkActions.onBulkUnassign(selectedIds);
    finish();
  }, [bulkActions, selectedIds, finish]);

  const handleExport = useCallback(() => {
    bulkActions.onExportCsv(selectedData);
    finish();
  }, [bulkActions, selectedData, finish]);

  const openRetire = useCallback(() => setShowRetireDialog(true), []);
  const openUnassign = useCallback(() => setShowUnassignDialog(true), []);

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleExport}>
          <Download className={iconSize.sm} />
          {t('exportCsv')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={bulkActions.isUnassigning}
          onClick={openUnassign}>
          {bulkActions.isUnassigning ? (
            <Loader2 className={`${iconSize.sm} animate-spin`} />
          ) : (
            <UserMinus className={iconSize.sm} />
          )}
          {t('unassign')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          disabled={bulkActions.isRetiring}
          onClick={openRetire}>
          {bulkActions.isRetiring ? (
            <Loader2 className={`${iconSize.sm} animate-spin`} />
          ) : (
            <Archive className={iconSize.sm} />
          )}
          {t('retire')}
        </Button>
      </div>

      <AlertDialog open={showRetireDialog} onOpenChange={setShowRetireDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('retireConfirmTitle', { count })}</AlertDialogTitle>
            <AlertDialogDescription>{t('retireConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={bulkActions.isRetiring}
              onClick={handleConfirmRetire}>
              {bulkActions.isRetiring ? (
                <Loader2 className={`me-2 ${iconSize.md} animate-spin`} />
              ) : null}
              {t('retireCta', { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unassignConfirmTitle', { count })}</AlertDialogTitle>
            <AlertDialogDescription>{t('unassignConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={bulkActions.isUnassigning} onClick={handleConfirmUnassign}>
              {bulkActions.isUnassigning ? (
                <Loader2 className={`me-2 ${iconSize.md} animate-spin`} />
              ) : null}
              {t('unassignCta', { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
