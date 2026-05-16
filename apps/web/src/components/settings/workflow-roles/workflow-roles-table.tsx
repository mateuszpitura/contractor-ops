'use client';

import { AtelierEmptyState, WorkflowsIllustration } from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/trpc/init';
import type { WorkflowRoleFormInput } from './workflow-role-form-dialog';
import { WorkflowRoleFormDialog } from './workflow-role-form-dialog';

interface WorkflowRolesTableProps {
  canCreate?: boolean;
  onCreate?: () => void;
}

export function WorkflowRolesTable({ canCreate, onCreate }: WorkflowRolesTableProps) {
  const t = useTranslations('WorkflowRoles');
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.workflowRoles.list.queryOptions());

  const [editing, setEditing] = useState<WorkflowRoleFormInput | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation(
    trpc.workflowRoles.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.deleted'));
        queryClient.invalidateQueries(trpc.workflowRoles.pathFilter());
        setDeleting(null);
      },
      onError: err => toast.error(err.message),
    }),
  );

  if (listQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const rows = listQuery.data ?? [];

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
        <WorkflowRoleFormDialog
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
