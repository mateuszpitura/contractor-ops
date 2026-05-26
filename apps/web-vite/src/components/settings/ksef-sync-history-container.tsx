import { useKsefSyncHistory } from './hooks/use-ksef-sync-history.js';
import { KsefSyncHistory } from './ksef-sync-history.js';

interface KsefSyncHistoryContainerProps {
  connectionId: string | undefined;
}

// Decision: data-table host — sync history card mounted by KsefControlsContainer only
// when a connection exists (parent already returns null otherwise); view delegates
// loading/empty row variants to the table shell.
export function KsefSyncHistoryContainer({ connectionId }: KsefSyncHistoryContainerProps) {
  const history = useKsefSyncHistory(connectionId);
  return <KsefSyncHistory connectionId={connectionId} {...history} />;
}
