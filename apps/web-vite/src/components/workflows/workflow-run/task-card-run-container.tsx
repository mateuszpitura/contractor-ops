import { useTaskCardRun } from '../hooks/use-task-card-run.js';
import { TaskAttachmentsContainer } from './task-attachments-container.js';
import type { TaskCardRunTask } from './task-card-run.js';
import { TaskCardRun } from './task-card-run.js';
import { TaskCommentsContainer } from './task-comments-container.js';

interface TaskCardRunContainerProps {
  task: TaskCardRunTask;
  runId: string;
  currentUserId: string | null;
  dependencyTitle?: string;
}

// Decision: composition — wires TaskCardRun view with TaskAttachmentsContainer
// + TaskCommentsContainer sub-containers (each owning its own tRPC boundary)
// inside the task-checklist scroll list.
export function TaskCardRunContainer({
  task,
  runId,
  currentUserId,
  dependencyTitle,
}: TaskCardRunContainerProps) {
  const actions = useTaskCardRun(runId);
  return (
    <TaskCardRun
      task={task}
      runId={runId}
      currentUserId={currentUserId}
      dependencyTitle={dependencyTitle}
      {...actions}
      attachmentsSection={<TaskAttachmentsContainer taskRunId={task.id} />}
      commentsSection={<TaskCommentsContainer runId={runId} taskRunId={task.id} />}
    />
  );
}
