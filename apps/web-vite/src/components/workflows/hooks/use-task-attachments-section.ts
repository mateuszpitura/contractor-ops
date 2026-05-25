import { useCallback } from 'react';

import { useWorkflowTaskAttachments } from './use-workflow-ui.js';

export interface AttachmentRow {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  virusScanStatus: string;
  createdAt: string | Date;
  uploadedByUserId: string | null;
  status: string;
}

export function useTaskAttachmentsSection(taskRunId: string) {
  const docsQuery = useWorkflowTaskAttachments(taskRunId);

  const documents = (docsQuery.data?.items ?? []) as unknown as AttachmentRow[];

  const handleRetry = useCallback(() => {
    void docsQuery.refetch();
  }, [docsQuery]);

  return {
    taskRunId,
    documents,
    isLoading: docsQuery.isLoading,
    isError: docsQuery.isError,
    handleRetry,
  } as const;
}
