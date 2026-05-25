import { useTaskCommentsSection } from '../hooks/use-task-comments-section.js';
import { TaskComments } from './task-comments.js';

interface TaskCommentsContainerProps {
  runId: string;
  taskRunId: string;
}

export function TaskCommentsContainer({ runId, taskRunId }: TaskCommentsContainerProps) {
  const comments = useTaskCommentsSection(runId, taskRunId);
  return <TaskComments {...comments} />;
}
