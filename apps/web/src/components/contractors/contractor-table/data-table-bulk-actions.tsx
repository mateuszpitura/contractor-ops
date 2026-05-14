'use client';

import { iconSize } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import type { Table } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TemplatePicker } from '@/components/workflows/template-picker-dialog';
import { useResourceMutation } from '@/hooks/use-resource-mutation';
import { trpc } from '@/trpc/init';
import type { ContractorAction } from '../actions';
import { getBulkContractorActions } from '../actions';
import type { ContractorRow } from './columns';

interface DataTableBulkActionsProps {
  table: Table<ContractorRow>;
}

/**
 * Bulk action toolbar shown when 1+ rows are selected.
 *
 * Inventory of actions is sourced from `getBulkContractorActions()` so
 * the toolbar cannot drift from the profile-header or row context menu.
 * Each action's `key` is matched to a bespoke UI control (popover /
 * dropdown / dialog / button) — the registry supplies label, icon and
 * variant, the consumer supplies the interaction shape.
 */
export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const t = useTranslations('Contractors.bulkActions');
  const ta = useTranslations('Contractors.archive');
  const tc = useTranslations('Contractors');

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const count = selectedIds.length;

  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  // ---- Registry lookups ---------------------------------------------------
  const actions = getBulkContractorActions();
  const actionByKey = new Map<string, ContractorAction>(actions.map(a => [a.key, a]));
  const assignOwnerAction = actionByKey.get('bulk.assignOwner');
  const exportAction = actionByKey.get('bulk.export');
  const archiveAction = actionByKey.get('archive');
  const launchWorkflowAction = actionByKey.get('launchWorkflow');

  // Alias icons to uppercase identifiers so JSX treats them as components.
  const AssignOwnerIcon = assignOwnerAction?.icon;
  const ExportIcon = exportAction?.icon;
  const ArchiveIcon = archiveAction?.icon;
  const LaunchWorkflowIcon = launchWorkflowAction?.icon;

  // Match the original broad invalidation scope so any contractor-scoped
  // query (list, getById, summaries, etc.) gets refreshed after bulk ops.
  const contractorPrefixKey = ['contractor'] as const;
  const deselect = () => table.toggleAllPageRowsSelected(false);

  // ---- Mutations (canonical pattern via useResourceMutation) --------------
  const bulkArchiveMutation = useResourceMutation(trpc.contractor.bulkArchive.mutationOptions(), {
    invalidate: [contractorPrefixKey],
    successMessage: tc('archived', { count }),
    errorMessage: tc('error.loadFailed'),
    onClose: () => {
      deselect();
      setShowArchiveDialog(false);
    },
  });

  const bulkAssignOwnerMutation = useResourceMutation(
    trpc.contractor.bulkAssignOwner.mutationOptions(),
    {
      invalidate: [contractorPrefixKey],
      successMessage: tc('ownerAssigned', { count }),
      errorMessage: tc('error.loadFailed'),
      onClose: () => {
        deselect();
        setOwnerPopoverOpen(false);
      },
    },
  );

  const exportMutation = useResourceMutation(
    trpc.contractor.export.mutationOptions({
      onSuccess: data => {
        const result = data as {
          data: string;
          filename: string;
          mimeType: string;
        };
        // Decode base64 and trigger download
        const binaryStr = atob(result.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      },
    }),
    {
      invalidate: [],
      successMessage: tc('exported', { count }),
      errorMessage: tc('error.loadFailed'),
      onClose: deselect,
    },
  );

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        {/* Assign owner */}
        {!!assignOwnerAction && !!AssignOwnerIcon && (
          <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                  <AssignOwnerIcon className={iconSize.sm} />
                  {t(assignOwnerAction.labelKey)}
                </Button>
              )}
            />
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                {(
                  users as Array<{
                    id?: string;
                    userId?: string;
                    name?: string | null;
                    email?: string | null;
                  }>
                ).map(user => {
                  const userId = user.userId ?? user.id ?? '';
                  return (
                    <button
                      key={userId}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent"
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() =>
                        bulkAssignOwnerMutation.mutate({
                          ids: selectedIds,
                          ownerUserId: userId,
                        })
                      }
                      disabled={bulkAssignOwnerMutation.isPending}>
                      <span className="truncate">{user.name ?? user.email ?? userId}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Export */}
        {!!exportAction && !!ExportIcon && (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                  {exportMutation.isPending ? (
                    <Loader2 className={`${iconSize.sm} animate-spin`} />
                  ) : (
                    <ExportIcon className={iconSize.sm} />
                  )}
                  {t(exportAction.labelKey)}
                </Button>
              )}
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => exportMutation.mutate({ ids: selectedIds, format: 'csv' })}
                disabled={exportMutation.isPending}>
                {t('exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => exportMutation.mutate({ ids: selectedIds, format: 'xlsx' })}
                disabled={exportMutation.isPending}>
                {t('exportXlsx')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Archive */}
        {!!archiveAction && !!ArchiveIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setShowArchiveDialog(true)}>
            <ArchiveIcon className={iconSize.sm} />
            {t(archiveAction.labelKey)}
          </Button>
        )}

        {/* Launch workflow */}
        {!!launchWorkflowAction && !!LaunchWorkflowIcon && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setWorkflowPickerOpen(true)}>
            <LaunchWorkflowIcon className={iconSize.sm} />
            {t(launchWorkflowAction.labelKey)}
          </Button>
        )}
      </div>

      {/* Workflow template picker */}
      <TemplatePicker
        open={workflowPickerOpen}
        onOpenChange={setWorkflowPickerOpen}
        contractorId={count === 1 ? selectedIds[0] : undefined}
        contractorIds={count > 1 ? selectedIds : undefined}
      />

      {/* Archive confirmation dialog */}
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
              onClick={() => bulkArchiveMutation.mutate({ ids: selectedIds })}
              disabled={bulkArchiveMutation.isPending}
              variant="destructive">
              {bulkArchiveMutation.isPending ? (
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
