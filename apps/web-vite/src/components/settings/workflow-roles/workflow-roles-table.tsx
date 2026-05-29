import { WorkflowsIllustration } from '@contractor-ops/ui';
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
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { SimpleDataTable } from '../../shared/simple-data-table.js';
import type { useWorkflowRolesTable } from './hooks/use-workflow-roles-table.js';
import { WorkflowRoleFormDialogContainer } from './workflow-role-form-dialog-container.js';

interface WorkflowRolesTableProps {
  canCreate?: boolean;
  onCreate?: () => void;
}

export type WorkflowRolesTableViewProps = WorkflowRolesTableProps &
  ReturnType<typeof useWorkflowRolesTable>;

type WorkflowRoleRow = WorkflowRolesTableViewProps['rows'][number];

export function WorkflowRolesTable({
  canCreate,
  onCreate,
  t,
  listQuery,
  rows,
  editing,
  setEditing,
  deleting,
  setDeleting,
  deleteMutation,
}: WorkflowRolesTableViewProps) {
  const columns = useMemo<ColumnDef<WorkflowRoleRow, unknown>[]>(
    () => [
      {
        id: 'role',
        accessorKey: 'role',
        header: t('table.role'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.role}</span>,
      },
      {
        id: 'displayName',
        accessorFn: row => row.displayNameEn ?? '',
        header: t('table.displayName'),
        cell: ({ row }) => row.original.displayNameEn ?? '',
      },
      {
        id: 'taskCount',
        accessorFn: row => row.taskTemplates.length,
        header: t('table.taskCount'),
        cell: ({ row }) => row.original.taskTemplates.length,
      },
      {
        id: 'kind',
        accessorFn: row => (row.isSeed ? 0 : 1),
        header: t('table.kind'),
        cell: ({ row }) =>
          row.original.isSeed ? (
            <Badge variant="secondary">{t('badge.seed')}</Badge>
          ) : (
            <Badge>{t('badge.custom')}</Badge>
          ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-end">{t('table.actions')}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.isSeed) return null;
          return (
            <div className="inline-flex w-full items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('action.edit')}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() =>
                  setEditing({
                    id: row.original.id,
                    role: row.original.role,
                    displayNameEn: row.original.displayNameEn ?? '',
                    displayNamePl: row.original.displayNamePl ?? '',
                    displayNameDe: row.original.displayNameDe ?? '',
                    taskItems: row.original.taskTemplates.map(item => ({
                      sortOrder: item.sortOrder,
                      titleEn: item.titleEn ?? '',
                      titlePl: item.titlePl ?? '',
                      titleDe: item.titleDe ?? '',
                      descriptionEn: item.descriptionEn ?? '',
                      descriptionPl: item.descriptionPl ?? '',
                      descriptionDe: item.descriptionDe ?? '',
                      dueDayOffset: item.dueDayOffset,
                      requiredDocs: Array.isArray(item.requiredDocsJson)
                        ? (item.requiredDocsJson as string[])
                        : [],
                    })),
                  })
                }>
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('action.delete')}
                className="text-destructive hover:text-destructive"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() =>
                  setDeleting({ id: row.original.id, name: row.original.displayNameEn ?? '' })
                }>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [t, setEditing, setDeleting],
  );

  return (
    <>
      <SimpleDataTable
        columns={columns}
        data={rows}
        isLoading={listQuery.isLoading}
        entityLabel={t('entityLabel', { count: rows.length })}
        emptyIcon={<WorkflowsIllustration className="h-6 w-6" aria-hidden="true" />}
        emptyTitle={t('empty.heading')}
        emptyDescription={t('empty.body')}
        emptyCta={canCreate && onCreate ? t('empty.cta') : undefined}
        onEmptyCta={canCreate ? onCreate : undefined}
        emptyCtaIcon={Plus}
        noResultsTitle={t('empty.heading')}
        noResultsDescription={t('empty.body')}
      />

      {editing && (
        <WorkflowRoleFormDialogContainer
          mode="edit"
          initial={editing}
          open={!!editing}
          onOpenChange={open => {
            if (!open) setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('deleteDialog.title', { name: deleting?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDialog.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => deleting && deleteMutation.mutate({ id: deleting.id })}
              disabled={deleteMutation.isPending}>
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
