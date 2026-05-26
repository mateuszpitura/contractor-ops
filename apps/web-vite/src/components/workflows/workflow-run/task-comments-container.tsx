import type { ReactNode } from 'react';

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

  let listContent: ReactNode;
  if (isLoading) {
    listContent = <TaskCommentsSkeleton />;
  } else {
    listContent = <TaskCommentsList comments={comments} />;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t('commentsHeading')}</h4>
      {listContent}
      <TaskCommentsComposer
        body={body}
        setBody={setBody}
        isSubmitting={isSubmitting}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}
