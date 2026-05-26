import { AtelierEmptyState, WorkflowsIllustration } from '@contractor-ops/ui';
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
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { renderEmptyStateAction } from '../../shared/atelier-bridges';
import type { useWorkflowRolesTable } from './hooks/use-workflow-roles-table.js';
import { WorkflowRoleFormDialogContainer } from './workflow-role-form-dialog-container.js';

interface WorkflowRolesTableProps {
  canCreate?: boolean;
  onCreate?: () => void;
}

export type WorkflowRolesTableViewProps = WorkflowRolesTableProps &
  ReturnType<typeof useWorkflowRolesTable>;

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
  if (listQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <AtelierEmptyState
        illustration={WorkflowsIllustration}
        heading={t('empty.heading')}
        body={t('empty.body')}
        primaryAction={
          canCreate && onCreate
            ? { label: t('empty.cta'), onClick: onCreate, icon: Plus }
            : undefined
        }
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.role')}</TableHead>
              <TableHead>{t('table.displayName')}</TableHead>
              <TableHead>{t('table.taskCount')}</TableHead>
              <TableHead>{t('table.kind')}</TableHead>
              <TableHead className="text-end">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.role}</TableCell>
                <TableCell>{row.displayNameEn ?? ''}</TableCell>
                <TableCell>{row.taskTemplates.length}</TableCell>
                <TableCell>
                  {row.isSeed ? (
                    <Badge variant="secondary">{t('badge.seed')}</Badge>
                  ) : (
                    <Badge>{t('badge.custom')}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  {!row.isSeed && (
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('action.edit')}
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() =>
                          setEditing({
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
                        onClick={() => setDeleting({ id: row.id, name: row.displayNameEn ?? '' })}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
