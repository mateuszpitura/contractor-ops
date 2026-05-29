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
import { memo, useCallback, useMemo } from 'react';

import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { formatDate } from '../../lib/format-date.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { SimpleDataTable } from '../shared/simple-data-table.js';
import type { TemplateRow, useTemplatesTable } from './hooks/use-templates-table.js';

const stopMouseEventPropagation = (e: React.MouseEvent) => e.stopPropagation();

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

interface TemplateActionsCellProps {
  template: TemplateRow;
  t: ReturnType<typeof useTranslations>;
  onEdit: (id: string) => void;
  onDuplicate: (template: TemplateRow) => Promise<unknown> | unknown;
  onActivate: (template: TemplateRow) => Promise<unknown> | unknown;
  onArchive: (template: TemplateRow) => Promise<unknown> | unknown;
  onDelete: (template: TemplateRow) => void;
}

const TemplateActionsCell = memo(function TemplateActionsCell({
  template,
  t,
  onEdit,
  onDuplicate,
  onActivate,
  onArchive,
  onDelete,
}: TemplateActionsCellProps) {
  const handleEdit = useCallback(() => onEdit(template.id), [onEdit, template.id]);
  const handleDuplicate = useCallback(() => void onDuplicate(template), [onDuplicate, template]);
  const handleActivate = useCallback(() => void onActivate(template), [onActivate, template]);
  const handleArchive = useCallback(() => void onArchive(template), [onArchive, template]);
  const handleDelete = useCallback(() => onDelete(template), [onDelete, template]);

  const renderTrigger = useCallback(
    (props: React.ComponentPropsWithoutRef<typeof Button>) => (
      <Button
        {...props}
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={stopMouseEventPropagation}>
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">{t('templates.actions')}</span>
      </Button>
    ),
    [t],
  );

  return (
    <div className="text-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={renderTrigger} />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleEdit}>
            <Pencil className="me-2 h-4 w-4" />
            {t('templates.actionEdit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleDuplicate}>
            <Copy className="me-2 h-4 w-4" />
            {t('templates.actionDuplicate')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {template.status === 'DRAFT' && (
            <DropdownMenuItem onSelect={handleActivate}>
              <Power className="me-2 h-4 w-4" />
              {t('templates.actionActivate')}
            </DropdownMenuItem>
          )}
          {template.status === 'ACTIVE' && (
            <DropdownMenuItem onSelect={handleArchive}>
              <Archive className="me-2 h-4 w-4" />
              {t('templates.actionArchive')}
            </DropdownMenuItem>
          )}
          {template.status === 'DRAFT' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={handleDelete}>
                <Trash2 className="me-2 h-4 w-4" />
                {t('templates.actionDelete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

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
        cell: ({ row }) => (
          <TemplateActionsCell
            template={row.original}
            t={t}
            onEdit={handleRowNavigate}
            onDuplicate={handleDuplicate}
            onActivate={handleActivate}
            onArchive={handleArchive}
            onDelete={setDeleteTarget}
          />
        ),
      },
    ],
    [t, handleRowNavigate, handleDuplicate, handleActivate, handleArchive, setDeleteTarget],
  );

  const handleRowClickTemplate = useCallback(
    (template: TemplateRow) => handleRowNavigate(template.id),
    [handleRowNavigate],
  );

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setDeleteTarget(null);
    },
    [setDeleteTarget],
  );

  const handleDeleteConfirm = useCallback(() => void handleDelete(), [handleDelete]);

  if (!isLoading && templates.length === 0) {
    return (
      <AtelierEmptyState
        variant="page"
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
        pageSize={25}
        constrainHeight={false}
        emptyIllustration={TemplatesIllustration}
        entityLabel={t('templatesEntityLabel', { count: templates.length })}
        emptyTitle={tEmpty('heading')}
        emptyDescription={tEmpty('body')}
        noResultsTitle={tEmpty('heading')}
        noResultsDescription={tEmpty('body')}
        onRowClick={handleRowClickTemplate}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={handleDeleteDialogOpenChange}>
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
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
              {t('templates.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
