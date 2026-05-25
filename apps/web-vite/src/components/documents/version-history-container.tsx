import { useVersionHistory } from './hooks/use-version-history.js';
import {
  VersionHistoryCollapsedTrigger,
  VersionHistoryEmpty,
  VersionHistoryList,
  VersionHistoryLoading,
} from './version-history.js';

type VersionHistoryProps = {
  documentId: string;
};

export function VersionHistory({ documentId }: VersionHistoryProps) {
  const { expanded, isLoading, versions, onToggle, onDownloadVersion } =
    useVersionHistory(documentId);

  if (!expanded) return <VersionHistoryCollapsedTrigger onToggle={onToggle} />;
  if (isLoading) return <VersionHistoryLoading onToggle={onToggle} />;
  if (versions.length <= 1) return <VersionHistoryEmpty onToggle={onToggle} />;
  return (
    <VersionHistoryList
      versions={versions}
      onToggle={onToggle}
      onDownloadVersion={onDownloadVersion}
    />
  );
}
