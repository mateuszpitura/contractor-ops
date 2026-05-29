import { AtelierEmptyState, SectionLabel, TemplatesIllustration } from '@contractor-ops/ui';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { ColumnDef } from '@tanstack/react-table';
import { Archive, Copy, GitBranch, MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { formatDate } from '../../lib/format-date.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { SimpleDataTable } from '../shared/simple-data-table.js';
import type { TemplateRow, useTemplatesTable } from './hooks/use-templates-table.js';

const templateStatusBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  ACTIVE: 'bg-green-500/10 text-green-800 dark:text-green-400',
  ARCHIVED: 'bg-muted/50 text-muted-foreground/60 border border-border/50',
};

const templateTypeBadgeColors: Record<string, string> = {
  ONBOARDING: 'bg-primary/10 text-primary',
  OFFBOARDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  DOCUMENT_COLLECTION: 'bg-muted text-muted-foreground',
  COMPLIANCE_REVIEW: 'bg-muted text-muted-foreground',
  CUSTOM: 'bg-muted text-muted-foreground',
};

type TemplatesTableProps = ReturnType<typeof useTemplatesTable>;

export function TemplatesTable({
  templates,
  isLoading,
  deleteTarget,
  setDeleteTarget,
  handleActivate,
  handleArchive,
  handleDuplicate,
  handleDelete,
  handleRowNavigate,
}: TemplatesTableProps) {
  const t = useTranslations('Workflows');
  const tEmpty = useTranslations('EmptyStates.templates');

  const columns = useMemo<ColumnDef<TemplateRow, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('templates.columns.name'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: t('templates.columns.type'),
        cell: ({ row }) => (
          <Badge variant="secondary" className={templateTypeBadgeColors[row.original.type] ?? ''}>
            {tDynLoose(t, 'templateType', enumKey(row.original.type))}
          </Badge>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('templates.columns.status'),
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={templateStatusBadgeColors[row.original.status] ?? ''}>
            {tDynLoose(t, 'templateStatus', enumKey(row.original.status))}
          </Badge>
        ),
      },
      {
        id: 'taskCount',
        accessorFn: row => row._count.tasks,
        header: t('templates.columns.taskCount'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original._count.tasks}</span>
        ),
      },
      {
        id: 'lastUpdated',
        accessorFn: row => new Date(row.updatedAt).getTime(),
        header: t('templates.columns.lastUpdated'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('templates.actions')}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const template = row.original;
          return (
            <div className="text-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                  render={props => (
                    <Button
                      {...props}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
                      onClick={e => e.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">{t('templates.actions')}</span>
                    </Button>
                  )}
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                    onSelect={() => handleRowNavigate(template.id)}>
                    <Pencil className="me-2 h-4 w-4" />
                    {t('templates.actionEdit')}
                  </DropdownMenuItem>
                  {/* biome-ignore lint/nursery/noJsxPropsBind: menu item handler */}
                  <DropdownMenuItem onSelect={() => void handleDuplicate(template)}>
                    <Copy className="me-2 h-4 w-4" />
                    {t('templates.actionDuplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {template.status === 'DRAFT' && (
                    // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                    <DropdownMenuItem onSelect={() => void handleActivate(template)}>
                      <Power className="me-2 h-4 w-4" />
                      {t('templates.actionActivate')}
                    </DropdownMenuItem>
                  )}
                  {template.status === 'ACTIVE' && (
                    // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                    <DropdownMenuItem onSelect={() => void handleArchive(template)}>
                      <Archive className="me-2 h-4 w-4" />
                      {t('templates.actionArchive')}
                    </DropdownMenuItem>
                  )}
                  {template.status === 'DRAFT' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
                        onSelect={() => setDeleteTarget(template)}>
                        <Trash2 className="me-2 h-4 w-4" />
                        {t('templates.actionDelete')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, handleRowNavigate, handleDuplicate, handleActivate, handleArchive, setDeleteTarget],
  );

  if (!isLoading && templates.length === 0) {
    return (
      <AtelierEmptyState
        variant="subview"
        illustration={TemplatesIllustration}
        heading={tEmpty('heading')}
        body={tEmpty('body')}
        primaryAction={{
          label: tEmpty('cta'),
          href: '/workflows/templates/new',
        }}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <>
      <SectionLabel icon={GitBranch}>{t('tabTemplates')}</SectionLabel>
      <SimpleDataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        entityLabel={t('templatesEntityLabel', { count: templates.length })}
        emptyTitle={tEmpty('heading')}
        emptyDescription={tEmpty('body')}
        noResultsTitle={tEmpty('heading')}
        noResultsDescription={tEmpty('body')}
        onRowClick={template => handleRowNavigate(template.id)}
      />

      <AlertDialog
        open={deleteTarget !== null}
        // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
        onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('templates.deleteTitle', { name: deleteTarget?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('templates.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('templates.deleteCancel')}</AlertDialogCancel>
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              {t('templates.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
