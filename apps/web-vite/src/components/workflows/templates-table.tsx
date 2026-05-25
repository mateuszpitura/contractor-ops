import {
  AtelierEmptyState,
  AtelierTableShell,
  SectionLabel,
  TableChrome,
  TemplatesIllustration,
} from '@contractor-ops/ui';
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
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Archive, Copy, GitBranch, MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { formatDate } from '../../lib/format-date.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
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

/**
 * Presentational table for the Templates tab.
 */
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
  const tAria = useTranslations('Common.aria');

  if (isLoading) {
    return (
      <>
        <SectionLabel icon={GitBranch}>{t('tabTemplates')}</SectionLabel>
        <AtelierTableShell isLoading>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('templates.columns.name')}</TableHead>
                <TableHead>{t('templates.columns.type')}</TableHead>
                <TableHead>{t('templates.columns.status')}</TableHead>
                <TableHead>{t('templates.columns.taskCount')}</TableHead>
                <TableHead>{t('templates.columns.lastUpdated')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AtelierTableShell>
      </>
    );
  }

  if (templates.length === 0) {
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
      <AtelierTableShell
        chrome={
          <TableChrome
            totalCount={templates.length}
            entityLabel={t('templatesEntityLabel', { count: templates.length })}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('templates.columns.name')}</TableHead>
              <TableHead>{t('templates.columns.type')}</TableHead>
              <TableHead>{t('templates.columns.status')}</TableHead>
              <TableHead>{t('templates.columns.taskCount')}</TableHead>
              <TableHead>{t('templates.columns.lastUpdated')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template: TemplateRow) => (
              <TableRow
                key={template.id}
                className="cursor-pointer"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => handleRowNavigate(template.id)}>
                <TableCell>
                  <span className="font-medium">{template.name}</span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={templateTypeBadgeColors[template.type] ?? ''}>
                    {tDynLoose(t, 'templateType', enumKey(template.type))}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={templateStatusBadgeColors[template.status] ?? ''}>
                    {tDynLoose(t, 'templateStatus', enumKey(template.status))}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm tabular-nums">{template._count.tasks}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(template.updatedAt)}
                  </span>
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AtelierTableShell>

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
