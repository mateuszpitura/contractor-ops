/**
 * TaskChecklist — list of tasks inside a workflow run detail page.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { useMemo } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { LinearLinkedIssuesPanelWired } from '../../contracts/contract-detail/linear-linked-issues-panel.js';
import { TaskCardRunSection } from './task-card-run.js';

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
  taskTitleMap?: Map<string, string>;
  /** Run's contractor — forwarded to the ACCESS_REVOKE trigger. */
  contractorId?: string | null;
}

function TaskChecklistSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
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

export function TaskChecklist({
  tasks,
  runId,
  currentUserId,
  isLoading,
  taskTitleMap,
  contractorId,
}: TaskChecklistProps) {
  const t = useTranslations('Workflows');

  const titleMap = taskTitleMap ?? new Map(tasks.map(task => [task.id, task.title]));

  const taskRunIds = useMemo(() => tasks.map(task => task.id), [tasks]);

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
      <LinearLinkedIssuesPanelWired taskRunIds={taskRunIds} />
      <div className="space-y-3">
        {tasks.map(task => {
          const isConditionSkipped =
            task.status === 'SKIPPED' &&
            (task.resultJson as Record<string, unknown>)?.skipReason ===
              workflowTaskSkipReason.conditionNotMet;

          return (
            <div key={task.id} className={isConditionSkipped ? 'opacity-50' : undefined}>
              <TaskCardRunSection
                task={task}
                runId={runId}
                currentUserId={currentUserId}
                contractorId={contractorId}
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
