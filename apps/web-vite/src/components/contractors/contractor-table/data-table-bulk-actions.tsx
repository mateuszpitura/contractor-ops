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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Loader2 } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { memo, useCallback, useState } from 'react';

import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { TemplatePickerDialog } from '../../workflows/template-picker-dialog.js';
import type { ContractorAction } from '../actions.js';
import { getBulkContractorActions } from '../actions.js';
import type { ContractorBulkActionsHandlers } from '../hooks/use-contractor-bulk-actions.js';
import type { ContractorUserOption } from '../hooks/use-contractor-list.js';
import type { ContractorRow } from './columns.js';

interface DataTableBulkActionsProps {
  selectedRows: ContractorRow[];
  users: ContractorUserOption[];
  bulkActions: ContractorBulkActionsHandlers;
  onComplete: () => void;
}

/**
 * Custom contractors bulk-action bar. Sits above the canonical DataTable via
 * its `toolbar` slot. Selection state owned by the primitive via
 * `enableRowSelection` + `onSelectionChange`; this component receives the
 * row originals directly.
 */
export function DataTableBulkActions({
  selectedRows,
  users,
  bulkActions,
  onComplete,
}: DataTableBulkActionsProps) {
  const t = useTranslations('Contractors.bulkActions');
  const ta = useTranslations('Contractors.archive');

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false);

  const selectedIds = selectedRows.map(row => row.id);
  const count = selectedIds.length;

  const actions = getBulkContractorActions();
  const actionByKey = new Map<string, ContractorAction>(actions.map(a => [a.key, a]));
  const assignOwnerAction = actionByKey.get('bulk.assignOwner');
  const exportAction = actionByKey.get('bulk.export');
  const archiveAction = actionByKey.get('archive');
  const launchWorkflowAction = actionByKey.get('launchWorkflow');

  const AssignOwnerIcon = assignOwnerAction?.icon;
  const ExportIcon = exportAction?.icon;
  const ArchiveIcon = archiveAction?.icon;
  const LaunchWorkflowIcon = launchWorkflowAction?.icon;

  const finish = useCallback(() => {
    onComplete();
    setShowArchiveDialog(false);
    setOwnerPopoverOpen(false);
  }, [onComplete]);

  const renderAssignOwnerTrigger = useCallback(
    (props: HTMLAttributes<HTMLButtonElement>) => {
      // Render only invoked when parent guards `assignOwnerAction` + icon truthy.
      const Icon = AssignOwnerIcon;
      const action = assignOwnerAction;
      if (!(Icon && action)) return <Button {...props} />;
      return (
        <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
          <Icon className={iconSize.sm} />
          {tKey(t, action.labelKey)}
        </Button>
      );
    },
    [AssignOwnerIcon, assignOwnerAction, t],
  );

  const renderExportTrigger = useCallback(
    (props: HTMLAttributes<HTMLButtonElement>) => {
      const Icon = ExportIcon;
      const action = exportAction;
      if (!(Icon && action)) return <Button {...props} />;
      return (
        <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
          {bulkActions.isExporting ? (
            <Loader2 className={`${iconSize.sm} animate-spin`} />
          ) : (
            <Icon className={iconSize.sm} />
          )}
          {tKey(t, action.labelKey)}
        </Button>
      );
    },
    [ExportIcon, exportAction, bulkActions.isExporting, t],
  );

  const handleExportCsv = useCallback(() => {
    bulkActions.onExport(selectedIds, 'csv');
    finish();
  }, [bulkActions, selectedIds, finish]);

  const handleExportXlsx = useCallback(() => {
    bulkActions.onExport(selectedIds, 'xlsx');
    finish();
  }, [bulkActions, selectedIds, finish]);

  const handleOpenArchiveDialog = useCallback(() => {
    setShowArchiveDialog(true);
  }, []);

  const handleOpenWorkflowPicker = useCallback(() => {
    setWorkflowPickerOpen(true);
  }, []);

  const handleConfirmArchive = useCallback(() => {
    bulkActions.onBulkArchive(selectedIds);
    finish();
  }, [bulkActions, selectedIds, finish]);

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        {!!assignOwnerAction && !!AssignOwnerIcon && (
          <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
            <PopoverTrigger render={renderAssignOwnerTrigger} />
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                {users.map(user => {
                  const userId = user.userId ?? user.id ?? '';
                  return (
                    <AssignOwnerOptionButton
                      key={userId}
                      userId={userId}
                      label={user.name ?? user.email ?? userId}
                      disabled={bulkActions.isAssigningOwner}
                      selectedIds={selectedIds}
                      onAssign={bulkActions.onBulkAssignOwner}
                      onComplete={finish}
                    />
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {!!exportAction && !!ExportIcon && (
          <DropdownMenu>
            <DropdownMenuTrigger render={renderExportTrigger} />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleExportCsv} disabled={bulkActions.isExporting}>
                {t('exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXlsx} disabled={bulkActions.isExporting}>
                {t('exportXlsx')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!!archiveAction && !!ArchiveIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
            onClick={handleOpenArchiveDialog}>
            <ArchiveIcon className={iconSize.sm} />
            {tKey(t, archiveAction.labelKey)}
          </Button>
        )}

        {!!launchWorkflowAction && !!LaunchWorkflowIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleOpenWorkflowPicker}>
            <LaunchWorkflowIcon className={iconSize.sm} />
            {tKey(t, launchWorkflowAction.labelKey)}
          </Button>
        )}
      </div>

      <TemplatePickerDialog
        open={workflowPickerOpen}
        onOpenChange={setWorkflowPickerOpen}
        contractorId={count === 1 ? selectedIds[0] : undefined}
        contractorIds={count > 1 ? selectedIds : undefined}
      />

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ta('titleBulk', { count })}</AlertDialogTitle>
            <AlertDialogDescription>{ta('bodyBulk')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmArchive}
              disabled={bulkActions.isArchiving}
              variant="destructive">
              {bulkActions.isArchiving ? (
                <Loader2 className={`me-2 ${iconSize.md} animate-spin`} />
              ) : null}
              {ta('ctaBulk', { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface AssignOwnerOptionButtonProps {
  userId: string;
  label: string;
  disabled: boolean;
  selectedIds: string[];
  onAssign: (contractorIds: string[], userId: string) => void;
  onComplete: () => void;
}

const AssignOwnerOptionButton = memo(function AssignOwnerOptionButton({
  userId,
  label,
  disabled,
  selectedIds,
  onAssign,
  onComplete,
}: AssignOwnerOptionButtonProps) {
  const handleClick = useCallback(() => {
    onAssign(selectedIds, userId);
    onComplete();
  }, [onAssign, selectedIds, userId, onComplete]);
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent"
      onClick={handleClick}
      disabled={disabled}>
      <span className="truncate">{label}</span>
    </button>
  );
});
