'use client';

import { AtelierEmptyState, MyTasksIllustration } from '@contractor-ops/ui';
import { Card } from '@contractor-ops/ui/components/shadcn/card';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDot,
  Lock,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Task status icon mapping per UI-SPEC
// ---------------------------------------------------------------------------

const TASK_STATUS_ICON: Record<string, { icon: React.ElementType; className: string }> = {
  TODO: { icon: Circle, className: 'text-muted-foreground' },
  IN_PROGRESS: { icon: CircleDot, className: 'text-primary' },
  DONE: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  BLOCKED: { icon: Lock, className: 'text-amber-600 dark:text-amber-400' },
  SKIPPED: { icon: SkipForward, className: 'text-muted-foreground/60' },
  CANCELLED: { icon: XCircle, className: 'text-muted-foreground/60' },
  OVERDUE: { icon: AlertCircle, className: 'text-destructive' },
};

// ---------------------------------------------------------------------------
// Task row type matching tRPC workflow.myTasks response
// ---------------------------------------------------------------------------

type MyTaskRow = {
  id: string;
  title: string;
  status: string;
  taskType: string;
  dueAt: string | null;
  isOverdue: boolean;
  workflowRun: {
    id: string;
    status: string;
    contractor: {
      id: string;
      legalName: string;
      displayName: string | null;
    };
    workflowTemplate: {
      name: string;
      type: string;
    };
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Flat task list showing the current user's assigned tasks across all workflows.
 * Overdue tasks are sorted to the top with red AlertCircle icon.
 */
export function MyTasksList() {
  const t = useTranslations('Workflows');
  const tEmpty = useTranslations('EmptyStates.myTasks');
  const reactId = useId();

  const [overdueOnly, setOverdueOnly] = useState(false);

  const tasksQuery = useQuery(
    trpc.workflow.myTasks.queryOptions({
      page: 1,
      pageSize: 50,
      overdueOnly: overdueOnly || undefined,
    }),
  );

  const tasks = useMemo(() => {
    const result = tasksQuery.data as { items: MyTaskRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [tasksQuery.data]);

  const isLoading = tasksQuery.isLoading;

  // Loading state: 5 skeleton cards
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Card key={`skel-${i}`} className="flex items-center gap-4 p-4">
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (tasks.length === 0 && !overdueOnly) {
    return (
      <AtelierEmptyState
        variant="subview"
        illustration={MyTasksIllustration}
        heading={tEmpty('heading')}
        body={tEmpty('body')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Overdue only toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id={`${reactId}-overdue-only-toggle`}
          checked={overdueOnly}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
          onCheckedChange={checked => setOverdueOnly(checked === true)}
        />
        <Label htmlFor={`${reactId}-overdue-only-toggle`} className="text-sm">
          {t('filterOverdueOnly')}
        </Label>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map(task => {
          const statusConfig = task.isOverdue
            ? TASK_STATUS_ICON.OVERDUE
            : (TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.TODO);
          const StatusIcon = statusConfig.icon;

          return (
            <Link key={task.id} href={`/workflows/${task.workflowRun.id}`} className="block">
              <Card
                className={`flex items-center gap-4 p-4 transition-colors hover:bg-accent/50 ${
                  task.isOverdue ? 'bg-destructive/[0.03]' : ''
                }`}>
                {/* Status icon */}
                <StatusIcon className={`h-5 w-5 shrink-0 ${statusConfig.className}`} />

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-[13px] text-muted-foreground truncate">
                    {task.workflowRun.workflowTemplate.name}
                    {' \u00B7 '}
                    {task.workflowRun.contractor.displayName ??
                      task.workflowRun.contractor.legalName}
                  </p>
                </div>

                {/* Due date */}
                {!!task.dueAt && (
                  <span
                    className={`text-[13px] shrink-0 ${
                      task.isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                    }`}>
                    {new Date(task.dueAt).toLocaleDateString('pl-PL')}
                  </span>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Empty filtered state */}
      {tasks.length === 0 && overdueOnly && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{t('myTasks.noOverdue')}</p>
        </div>
      )}
    </div>
  );
}
