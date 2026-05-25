import { useVersionHistory } from './hooks/use-version-history.js';
import { VersionHistoryView } from './version-history.js';

type VersionHistoryProps = {
  documentId: string;
};

export function VersionHistory({ documentId }: VersionHistoryProps) {
  const history = useVersionHistory(documentId);
  return <VersionHistoryView {...history} />;
}
