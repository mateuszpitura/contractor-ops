/**
 * TaskAttachments — document list and upload for a workflow task run.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DropZoneContainer } from '../../documents/drop-zone-container.js';
import type {
  AttachmentRow,
  useTaskAttachmentsSection,
} from '../hooks/use-task-attachments-section.js';

type TaskAttachmentsProps = ReturnType<typeof useTaskAttachmentsSection>;

export function TaskAttachments({
  taskRunId,
  documents,
  isLoading,
  isError,
  handleRetry,
}: TaskAttachmentsProps) {
  const t = useTranslations('Workflows');
  const tCommon = useTranslations('Common');
  const [showDropZone, setShowDropZone] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('attachmentsHeading')}</h4>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button variant="ghost" size="sm" onClick={() => setShowDropZone(prev => !prev)}>
          {t('addAttachment')}
        </Button>
      </div>

      {isError ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-3">
          <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            {t('errors.retry')}
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`skel-${i}`} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 && !showDropZone ? (
        <p className="text-sm text-muted-foreground">{t('noAttachments')}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc: AttachmentRow) => (
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
      )}

      {!!showDropZone && <DropZoneContainer entityType="WORKFLOW_TASK_RUN" entityId={taskRunId} />}
    </div>
  );
}
