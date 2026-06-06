import { DeprovisioningTriggerContainer } from '../../idp/deprovisioning-trigger-container.js';
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
  /** Run's contractor (Phase 81 D-01) — drives the inline ACCESS_REVOKE trigger. */
  contractorId?: string | null;
}

// Decision: composition — wires TaskCardRun view with TaskAttachmentsContainer
// + TaskCommentsContainer sub-containers (each owning its own tRPC boundary)
// inside the task-checklist scroll list. For ACCESS_REVOKE tasks it also mounts
// the deprovisioning trigger (Phase 81 D-01): the hook resolves contractorId →
// assignmentId server-side, so the presentational card stays tRPC-free.
export function TaskCardRunContainer({
  task,
  runId,
  currentUserId,
  dependencyTitle,
  contractorId,
}: TaskCardRunContainerProps) {
  const actions = useTaskCardRun(runId);
  const triggerSlot =
    task.taskType === 'ACCESS_REVOKE' && contractorId ? (
      <DeprovisioningTriggerContainer contractorId={contractorId} />
    ) : undefined;
  return (
    <TaskCardRun
      task={task}
      runId={runId}
      currentUserId={currentUserId}
      dependencyTitle={dependencyTitle}
      {...actions}
      attachmentsSection={<TaskAttachmentsContainer taskRunId={task.id} />}
      commentsSection={<TaskCommentsContainer runId={runId} taskRunId={task.id} />}
      triggerSlot={triggerSlot}
    />
  );
}
