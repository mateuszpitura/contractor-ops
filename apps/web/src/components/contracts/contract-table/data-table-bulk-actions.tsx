'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Table } from '@tanstack/react-table';
import { Download, Loader2, XCircle } from 'lucide-react';
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
import { trpc } from '@/trpc/init';
import type { ContractRow } from './columns';

interface DataTableBulkActionsProps {
  table: Table<ContractRow>;
}

/**
 * Bulk action toolbar shown when 1+ rows are selected.
 * Includes export (CSV/XLSX) and terminate actions.
 */
export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const t = useTranslations('Contracts.bulkActions');
  const tc = useTranslations('Contracts');
  const td = useTranslations('Contracts.terminate');
  const queryClient = useQueryClient();

  const [showTerminateDialog, setShowTerminateDialog] = useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);
  const count = selectedIds.length;

  const invalidateAndDeselect = () => {
    queryClient.invalidateQueries({ queryKey: ['contract'] });
    table.toggleAllPageRowsSelected(false);
  };

  const bulkTransitionMutation = useMutation(
    trpc.contract.bulkTransition.mutationOptions({
      onSuccess: data => {
        const result = data as { updated: number; failed: string[] };
        toast.success(tc('terminated', { count: result.updated }));
        invalidateAndDeselect();
        setShowTerminateDialog(false);
      },
      onError: () => {
        toast.error(tc('error.loadFailed'));
      },
    }),
  );

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('selected', { count })}</span>

        {/* Export — placeholder for now, actual export router is not yet implemented */}
        <DropdownMenu>
          <DropdownMenuTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                {t('export')}
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

        {/* Terminate */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => setShowTerminateDialog(true)}>
          <XCircle className="h-3.5 w-3.5" />
          {t('terminate')}
        </Button>
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
                bulkTransitionMutation.mutate({
                  ids: selectedIds,
                  targetStatus: 'TERMINATED',
                })
              }
              disabled={bulkTransitionMutation.isPending}
              variant="destructive">
              {bulkTransitionMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : null}
              {td('ctaBulk', { count })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
