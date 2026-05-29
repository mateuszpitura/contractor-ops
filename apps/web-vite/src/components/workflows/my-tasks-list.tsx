import { AtelierEmptyState, MyTasksIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card } from '@contractor-ops/ui/components/shadcn/card';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDot,
  Lock,
  Play,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { useCallback, useId } from 'react';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { formatDate } from '../../lib/format-date.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import type { MyTaskRow, useMyTasksList } from './hooks/use-my-tasks-list.js';

const TASK_STATUS_ICON: Record<string, { icon: React.ElementType; className: string }> = {
  TODO: { icon: Circle, className: 'text-muted-foreground' },
  IN_PROGRESS: { icon: CircleDot, className: 'text-primary' },
  DONE: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  BLOCKED: { icon: Lock, className: 'text-amber-600 dark:text-amber-400' },
  SKIPPED: { icon: SkipForward, className: 'text-muted-foreground/60' },
  CANCELLED: { icon: XCircle, className: 'text-muted-foreground/60' },
  OVERDUE: { icon: AlertCircle, className: 'text-destructive' },
};

export function MyTasksListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-9 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Card key={`skel-${i}`} className="flex flex-row items-center gap-4 p-4">
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>
    </div>
  );
}

interface MyTasksListErrorProps {
  onRetry: () => void;
}

export function MyTasksListError({ onRetry }: MyTasksListErrorProps) {
  const t = useTranslations('Workflows');
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-medium">{t('errors.failedToLoadWorkflows')}</h2>
      <Button variant="outline" onClick={onRetry}>
        {t('errors.retry')}
      </Button>
    </div>
  );
}

export function MyTasksListEmpty({ onStartWorkflow }: { onStartWorkflow?: () => void }) {
  const tEmpty = useTranslations('EmptyStates.myTasks');
  return (
    <AtelierEmptyState
      variant="page"
      illustration={MyTasksIllustration}
      heading={tEmpty('heading')}
      body={tEmpty('body')}
      primaryAction={
        onStartWorkflow ? { label: tEmpty('cta'), onClick: onStartWorkflow, icon: Play } : undefined
      }
      renderAction={renderEmptyStateAction}
    />
  );
}

interface MyTasksListBodyProps {
  tasks: MyTaskRow[];
  overdueOnly: boolean;
  setOverdueOnly: (value: boolean) => void;
}

export function MyTasksListBody({ tasks, overdueOnly, setOverdueOnly }: MyTasksListBodyProps) {
  const t = useTranslations('Workflows');
  const reactId = useId();
  const handleOverdueToggle = useCallback(
    (checked: boolean) => setOverdueOnly(checked === true),
    [setOverdueOnly],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch
          id={`${reactId}-overdue-only-toggle`}
          checked={overdueOnly}
          onCheckedChange={handleOverdueToggle}
        />
        <Label htmlFor={`${reactId}-overdue-only-toggle`} className="text-sm">
          {t('filterOverdueOnly')}
        </Label>
      </div>

      <div className="space-y-2">
        {tasks.map((task: MyTaskRow) => {
          const statusConfig = task.isOverdue
            ? TASK_STATUS_ICON.OVERDUE
            : (TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.TODO);
          const StatusIcon = statusConfig.icon;

          return (
            <Link key={task.id} href={`/workflows/${task.workflowRun.id}`} className="block">
              <Card
                className={`flex flex-row items-center gap-4 p-4 transition-colors hover:bg-accent/50 ${
                  task.isOverdue ? 'bg-destructive/[0.03]' : ''
                }`}>
                <StatusIcon className={`h-5 w-5 shrink-0 ${statusConfig.className}`} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-[13px] text-muted-foreground truncate">
                    {task.workflowRun.workflowTemplate.name}
                    {' · '}
                    {task.workflowRun.contractor.displayName ??
                      task.workflowRun.contractor.legalName}
                  </p>
                </div>

                {!!task.dueAt && (
                  <span
                    className={`text-[13px] shrink-0 ${
                      task.isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                    }`}>
                    {formatDate(task.dueAt)}
                  </span>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      {tasks.length === 0 && overdueOnly && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{t('myTasks.noOverdue')}</p>
        </div>
      )}
    </div>
  );
}

type MyTasksListProps = ReturnType<typeof useMyTasksList>;

/**
 * Legacy combined presentational view — kept for tests. Single render path
 * per variant, picked here via the same flags the container consults.
 */
export function MyTasksList({
  tasks,
  isLoading,
  isError,
  handleRetry,
  overdueOnly,
  setOverdueOnly,
}: MyTasksListProps) {
  if (isError) return <MyTasksListError onRetry={handleRetry} />;
  if (isLoading) return <MyTasksListSkeleton />;
  if (tasks.length === 0 && !overdueOnly) return <MyTasksListEmpty />;
  return (
    <MyTasksListBody tasks={tasks} overdueOnly={overdueOnly} setOverdueOnly={setOverdueOnly} />
  );
}
