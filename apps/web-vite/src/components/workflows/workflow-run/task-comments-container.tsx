import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTaskCommentsSection } from '../hooks/use-task-comments-section.js';
import { TaskCommentsComposer, TaskCommentsList, TaskCommentsSkeleton } from './task-comments.js';

interface TaskCommentsContainerProps {
  runId: string;
  taskRunId: string;
}

export function TaskCommentsContainer({ runId, taskRunId }: TaskCommentsContainerProps) {
  const { body, setBody, comments, isLoading, isSubmitting, handleSubmit } = useTaskCommentsSection(
    runId,
    taskRunId,
  );
  const t = useTranslations('Workflows');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t('commentsHeading')}</h4>
      {isLoading ? <TaskCommentsSkeleton /> : <TaskCommentsList comments={comments} />}
      <TaskCommentsComposer
        body={body}
        setBody={setBody}
        isSubmitting={isSubmitting}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}
