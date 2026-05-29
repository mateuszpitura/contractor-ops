import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { DropZoneContainer } from '../../documents/drop-zone-container.js';
import { useTaskAttachmentsSection } from '../hooks/use-task-attachments-section.js';
import {
  TaskAttachmentsError,
  TaskAttachmentsList,
  TaskAttachmentsSkeleton,
} from './task-attachments.js';

interface TaskAttachmentsContainerProps {
  taskRunId: string;
}

export function TaskAttachmentsContainer({ taskRunId }: TaskAttachmentsContainerProps) {
  const { documents, isLoading, isError, handleRetry } = useTaskAttachmentsSection(taskRunId);
  const [showDropZone, setShowDropZone] = useState(false);
  const t = useTranslations('Workflows');
  const handleToggleDropZone = useCallback(() => setShowDropZone(prev => !prev), []);

  let body: React.ReactNode;
  if (isError) {
    body = <TaskAttachmentsError onRetry={handleRetry} />;
  } else if (isLoading) {
    body = <TaskAttachmentsSkeleton />;
  } else {
    body = (
      <TaskAttachmentsList
        documents={documents}
        emptyVisible={documents.length === 0 && !showDropZone}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('attachmentsHeading')}</h4>
        <Button variant="ghost" size="sm" onClick={handleToggleDropZone}>
          {t('addAttachment')}
        </Button>
      </div>
      {body}
      {!!showDropZone && <DropZoneContainer entityType="WORKFLOW_TASK_RUN" entityId={taskRunId} />}
    </div>
  );
}
