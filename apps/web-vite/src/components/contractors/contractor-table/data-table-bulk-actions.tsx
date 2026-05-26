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
import type { Table } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { tKey } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { TemplatePickerContainer } from '../../workflows/template-picker-container.js';
import type { ContractorAction } from '../actions.js';
import { getBulkContractorActions } from '../actions.js';
import type { ContractorBulkActionsHandlers } from '../hooks/use-contractor-bulk-actions.js';
import type { ContractorUserOption } from '../hooks/use-contractor-list.js';
import type { ContractorRow } from './columns.js';

interface DataTableBulkActionsProps {
  table: Table<ContractorRow>;
  users: ContractorUserOption[];
  bulkActions: ContractorBulkActionsHandlers;
  onComplete: () => void;
}

/**
 * Presentational bulk action toolbar. Mutations wired via `useContractorBulkActions`.
 */
export function DataTableBulkActions({
  table,
  users,
  bulkActions,
  onComplete,
}: DataTableBulkActionsProps) {
  const t = useTranslations('Contractors.bulkActions');
  const ta = useTranslations('Contractors.archive');

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
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

  const finish = () => {
    onComplete();
    setShowArchiveDialog(false);
    setOwnerPopoverOpen(false);
  };

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        {!!assignOwnerAction && !!AssignOwnerIcon && (
          <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                  <AssignOwnerIcon className={iconSize.sm} />
                  {tKey(t, assignOwnerAction.labelKey)}
                </Button>
              )}
            />
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                {users.map(user => {
                  const userId = user.userId ?? user.id ?? '';
                  return (
                    <button
                      key={userId}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent"
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => {
                        bulkActions.onBulkAssignOwner(selectedIds, userId);
                        finish();
                      }}
                      disabled={bulkActions.isAssigningOwner}>
                      <span className="truncate">{user.name ?? user.email ?? userId}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {!!exportAction && !!ExportIcon && (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                  {bulkActions.isExporting ? (
                    <Loader2 className={`${iconSize.sm} animate-spin`} />
                  ) : (
                    <ExportIcon className={iconSize.sm} />
                  )}
                  {tKey(t, exportAction.labelKey)}
                </Button>
              )}
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => {
                  bulkActions.onExport(selectedIds, 'csv');
                  finish();
                }}
                disabled={bulkActions.isExporting}>
                {t('exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => {
                  bulkActions.onExport(selectedIds, 'xlsx');
                  finish();
                }}
                disabled={bulkActions.isExporting}>
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
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setShowArchiveDialog(true)}>
            <ArchiveIcon className={iconSize.sm} />
            {tKey(t, archiveAction.labelKey)}
          </Button>
        )}

        {!!launchWorkflowAction && !!LaunchWorkflowIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setWorkflowPickerOpen(true)}>
            <LaunchWorkflowIcon className={iconSize.sm} />
            {tKey(t, launchWorkflowAction.labelKey)}
          </Button>
        )}
      </div>

      <TemplatePickerContainer
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
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                bulkActions.onBulkArchive(selectedIds);
                finish();
              }}
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
