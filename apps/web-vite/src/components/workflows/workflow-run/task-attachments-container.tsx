import { useTaskAttachmentsSection } from '../hooks/use-task-attachments-section.js';
import { TaskAttachments } from './task-attachments.js';

interface TaskAttachmentsContainerProps {
  taskRunId: string;
}

export function TaskAttachmentsContainer({ taskRunId }: TaskAttachmentsContainerProps) {
  const attachments = useTaskAttachmentsSection(taskRunId);
  return <TaskAttachments {...attachments} />;
}
