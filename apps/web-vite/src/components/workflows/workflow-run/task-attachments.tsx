/**
 * TaskAttachments — document list and upload for a workflow task run.
 * View is a single render path per variant: container decides loading / error /
 * data and renders the matching sub-component.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DropZoneContainer } from '../../documents/drop-zone-container.js';
import type { AttachmentRow } from '../hooks/use-task-attachments-section.js';

interface TaskAttachmentsShellProps {
  onAddClick: () => void;
  showDropZone: boolean;
  taskRunId: string;
  children: React.ReactNode;
}

function TaskAttachmentsShell({
  onAddClick,
  showDropZone,
  taskRunId,
  children,
}: TaskAttachmentsShellProps) {
  const t = useTranslations('Workflows');
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('attachmentsHeading')}</h4>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button variant="ghost" size="sm" onClick={onAddClick}>
          {t('addAttachment')}
        </Button>
      </div>
      {children}
      {!!showDropZone && <DropZoneContainer entityType="WORKFLOW_TASK_RUN" entityId={taskRunId} />}
    </div>
  );
}

export function TaskAttachmentsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 2 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <Skeleton key={`skel-${i}`} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

interface TaskAttachmentsErrorProps {
  onRetry: () => void;
}

export function TaskAttachmentsError({ onRetry }: TaskAttachmentsErrorProps) {
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-3">
      <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('errors.retry')}
      </Button>
    </div>
  );
}

interface TaskAttachmentsListProps {
  documents: AttachmentRow[];
  emptyVisible: boolean;
}

export function TaskAttachmentsList({ documents, emptyVisible }: TaskAttachmentsListProps) {
  const t = useTranslations('Workflows');
  if (emptyVisible) {
    return <p className="text-sm text-muted-foreground">{t('noAttachments')}</p>;
  }
  return (
    <ul className="space-y-2">
      {documents.map(doc => (
        <li
          key={doc.id}
          className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
          <span className="truncate font-medium">{doc.originalFileName}</span>
          <span className="ms-3 shrink-0 text-xs text-muted-foreground tabular-nums">
            {Math.max(1, Math.round(doc.fileSizeBytes / 1024))} KB
          </span>
        </li>
      ))}
    </ul>
  );
}

interface TaskAttachmentsProps {
  taskRunId: string;
  documents: AttachmentRow[];
  isLoading: boolean;
  isError: boolean;
  handleRetry: () => void;
}

/**
 * Combined view kept for legacy/test compatibility — single render path per
 * variant, picked here via the same flags the container would consult.
 */
export function TaskAttachments({
  taskRunId,
  documents,
  isLoading,
  isError,
  handleRetry,
}: TaskAttachmentsProps) {
  const [showDropZone, setShowDropZone] = useState(false);

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
    <TaskAttachmentsShell
      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
      onAddClick={() => setShowDropZone(prev => !prev)}
      showDropZone={showDropZone}
      taskRunId={taskRunId}>
      {body}
    </TaskAttachmentsShell>
  );
}

export { TaskAttachmentsShell };
