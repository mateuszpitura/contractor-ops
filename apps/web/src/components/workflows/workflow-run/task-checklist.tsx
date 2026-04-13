'use client';

import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { TaskCardRun } from './task-card-run';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskRun {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  required: boolean;
  assigneeUserId: string | null;
  assigneeRole: string | null;
  dueAt: string | Date | null;
  completedAt: string | Date | null;
  completedByUserId: string | null;
  startedAt: string | Date | null;
  dependsOnTaskRunId: string | null;
  resultJson: unknown;
  isOverdue: boolean;
  createdAt: string | Date;
}

interface TaskChecklistProps {
  tasks: TaskRun[];
  runId: string;
  currentUserId: string | null;
  isLoading?: boolean;
  /** Map of taskRunId -> task title for dependency tooltip display */
  taskTitleMap?: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TaskChecklistSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skel-${i}`} className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskChecklist({
  tasks,
  runId,
  currentUserId,
  isLoading,
  taskTitleMap,
}: TaskChecklistProps) {
  const t = useTranslations('Workflows');

  // Build task title map for dependency tooltips if not provided
  const titleMap = taskTitleMap ?? new Map(tasks.map(task => [task.id, task.title]));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-[20px] font-semibold leading-[1.2]">{t('tasksHeading')}</h2>
        <TaskChecklistSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[20px] font-semibold leading-[1.2]">{t('tasksHeading')}</h2>
      <div className="space-y-3">
        {tasks.map(task => {
          const isConditionSkipped =
            task.status === 'SKIPPED' &&
            (task.resultJson as Record<string, unknown>)?.skipReason ===
              workflowTaskSkipReason.conditionNotMet;

          return (
            <div key={task.id} className={isConditionSkipped ? 'opacity-50' : undefined}>
              <TaskCardRun
                task={task}
                runId={runId}
                currentUserId={currentUserId}
                dependencyTitle={
                  task.dependsOnTaskRunId
                    ? (titleMap.get(task.dependsOnTaskRunId) ?? undefined)
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
