'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, GitBranch, MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTemplateMutations } from '@/hooks/use-template-mutations';
import { Link, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Template status badge styling per UI-SPEC
// ---------------------------------------------------------------------------

const templateStatusBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400',
  ARCHIVED: 'bg-muted/50 text-muted-foreground/60 border border-border/50',
};

// ---------------------------------------------------------------------------
// Template type badge styling
// ---------------------------------------------------------------------------

const templateTypeBadgeColors: Record<string, string> = {
  ONBOARDING: 'bg-primary/10 text-primary',
  OFFBOARDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DOCUMENT_COLLECTION: 'bg-muted text-muted-foreground',
  COMPLIANCE_REVIEW: 'bg-muted text-muted-foreground',
  CUSTOM: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Template row type matching tRPC response
// ---------------------------------------------------------------------------

type TemplateRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    runs: number;
    tasks: number;
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Simple table for the Templates tab showing workflow template management.
 * Data from trpc.workflow.listTemplates.
 */
export function TemplatesTable() {
  const t = useTranslations('Workflows');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, _setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);

  // Fetch templates
  const templatesQuery = useQuery(
    trpc.workflow.listTemplates.queryOptions({
      page,
      pageSize: 25,
    }),
  );

  const templates = useMemo(() => {
    const result = templatesQuery.data as { items: TemplateRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [templatesQuery.data]);

  const total = useMemo(() => {
    const result = templatesQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [templatesQuery.data]);

  // Template CRUD mutations (extracted hook)
  const {
    activate: activateTemplate,
    archive: archiveTemplate,
    duplicate: duplicateTemplate,
    deleteTemplate,
  } = useTemplateMutations(t);

  // Seed starter templates on first visit (if org has no templates)
  const seedMutation = useMutation(trpc.workflow.seedStarterTemplates.mutationOptions());
  const seedAttempted = useRef(false);

  useEffect(() => {
    if (
      !templatesQuery.isLoading &&
      templates.length === 0 &&
      total === 0 &&
      !seedAttempted.current
    ) {
      seedAttempted.current = true;
      seedMutation.mutate(undefined, {
        onSuccess: data => {
          if ((data as { seeded: boolean }).seeded) {
            void queryClient.invalidateQueries({
              queryKey: [['workflow', 'listTemplates']],
            });
          }
        },
      });
    }
  }, [templatesQuery.isLoading, templates.length, total, seedMutation, queryClient]);

  const handleActivate = useCallback(
    (template: TemplateRow) => {
      void activateTemplate(template.id);
    },
    [activateTemplate],
  );

  const handleArchive = useCallback(
    (template: TemplateRow) => {
      void archiveTemplate(template.id);
    },
    [archiveTemplate],
  );

  const handleDuplicate = useCallback(
    (template: TemplateRow) => {
      void duplicateTemplate(template.id);
    },
    [duplicateTemplate],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    void deleteTemplate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteTemplate]);

  const isLoading = templatesQuery.isLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-background">
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
      </div>
    );
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <div className="py-16 text-center">
        <GitBranch className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-[16px] font-medium">{t('templates.empty.heading')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('templates.empty.body')}</p>
        <Button className="mt-4" render={<Link href="/workflows/templates/new" />}>
          {t('templates.empty.cta')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-background">
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
            {templates.map(template => (
              <TableRow
                key={template.id}
                className="cursor-pointer"
                onClick={() => router.push(`/workflows/templates/${template.id}`)}>
                <TableCell>
                  <span className="font-medium">{template.name}</span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={templateTypeBadgeColors[template.type] ?? ''}>
                    {t(`templateType.${template.type}` as Parameters<typeof t>[0])}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={templateStatusBadgeColors[template.status] ?? ''}>
                    {t(`templateStatus.${template.status}` as Parameters<typeof t>[0])}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm tabular-nums">{template._count.tasks}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(template.updatedAt).toLocaleDateString('pl-PL')}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={props => (
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={e => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t('templates.actions')}</span>
                        </Button>
                      )}
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => router.push(`/workflows/templates/${template.id}`)}>
                        <Pencil className="me-2 h-4 w-4" />
                        {t('templates.actionEdit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void handleDuplicate(template)}>
                        <Copy className="me-2 h-4 w-4" />
                        {t('templates.actionDuplicate')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {template.status === 'DRAFT' && (
                        <DropdownMenuItem onSelect={() => void handleActivate(template)}>
                          <Power className="me-2 h-4 w-4" />
                          {t('templates.actionActivate')}
                        </DropdownMenuItem>
                      )}
                      {template.status === 'ACTIVE' && (
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
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('templates.deleteTitle', { name: deleteTarget?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('templates.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('templates.deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              {t('templates.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
