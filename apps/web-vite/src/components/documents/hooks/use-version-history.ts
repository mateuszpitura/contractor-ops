import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';
import { useDocumentDownload } from './use-document-download.js';

export type VersionRow = {
  id: string;
  originalFileName: string;
  createdAt: string | Date;
  status: string;
};

export interface VersionHistoryProps {
  expanded: boolean;
  isLoading: boolean;
  versions: VersionRow[];
  onToggle: () => void;
  onDownloadVersion: (versionId: string) => void;
}

export function useVersionHistory(documentId: string): VersionHistoryProps {
  const trpc = useTRPC();
  const [expanded, setExpanded] = useState(false);
  const triggerDownload = useDocumentDownload();

  const historyQuery = useQuery({
    ...trpc.document.getVersionHistory.queryOptions({ documentId }),
    enabled: expanded,
  });

  const versions = (historyQuery.data ?? []) as VersionRow[];

  const onToggle = useCallback(() => setExpanded(prev => !prev), []);
  const onDownloadVersion = useCallback(
    (versionId: string) => {
      void triggerDownload(versionId);
    },
    [triggerDownload],
  );

  return {
    expanded,
    isLoading: historyQuery.isLoading,
    versions,
    onToggle,
    onDownloadVersion,
  };
}
