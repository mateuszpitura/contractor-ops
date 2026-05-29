import { TemplatesIllustration } from '@contractor-ops/ui';
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
import { useCallback, useMemo } from 'react';

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
type EditingPayload = NonNullable<WorkflowRolesTableViewProps['editing']>;
type DeletingPayload = NonNullable<WorkflowRolesTableViewProps['deleting']>;

interface RoleActionsCellProps {
  row: WorkflowRoleRow;
  editLabel: string;
  deleteLabel: string;
  onEdit: (payload: EditingPayload) => void;
  onDelete: (payload: DeletingPayload) => void;
}

function RoleActionsCell({ row, editLabel, deleteLabel, onEdit, onDelete }: RoleActionsCellProps) {
  const handleEdit = useCallback(
    () =>
      onEdit({
        id: row.id,
        role: row.role,
        displayNameEn: row.displayNameEn ?? '',
        displayNamePl: row.displayNamePl ?? '',
        displayNameDe: row.displayNameDe ?? '',
        taskItems: row.taskTemplates.map(item => ({
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
      }),
    [onEdit, row],
  );
  const handleDelete = useCallback(
    () => onDelete({ id: row.id, name: row.displayNameEn ?? '' }),
    [onDelete, row.id, row.displayNameEn],
  );

  return (
    <div className="inline-flex w-full items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={editLabel} onClick={handleEdit}>
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={deleteLabel}
        className="text-destructive hover:text-destructive"
        onClick={handleDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

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
  const handleEditDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setEditing(null);
    },
    [setEditing],
  );
  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setDeleting(null);
    },
    [setDeleting],
  );
  const handleDeleteConfirm = useCallback(() => {
    if (deleting) deleteMutation.mutate({ id: deleting.id });
  }, [deleting, deleteMutation]);

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
            <RoleActionsCell
              row={row.original}
              editLabel={t('action.edit')}
              deleteLabel={t('action.delete')}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
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
        isRefetching={listQuery.isFetching && !listQuery.isLoading}
        pageSize={25}
        constrainHeight={false}
        entityLabel={t('entityLabel', { count: rows.length })}
        emptyIllustration={TemplatesIllustration}
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
          onOpenChange={handleEditDialogOpenChange}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={handleDeleteDialogOpenChange}>
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
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}>
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
