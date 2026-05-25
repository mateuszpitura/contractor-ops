// Decision: history card mounted by KsefControls only when a connection exists (KsefControlsContainer
// already returns null when not connected — variant pick lives there). View branches on isLoading/empty
// for skeleton + empty-state UX; branches stay in view for test compatibility.
import { useKsefSyncHistory } from './hooks/use-ksef-sync-history.js';
import { KsefSyncHistory } from './ksef-sync-history.js';

interface KsefSyncHistoryContainerProps {
  connectionId: string | undefined;
}

export function KsefSyncHistoryContainer({ connectionId }: KsefSyncHistoryContainerProps) {
  const history = useKsefSyncHistory(connectionId);
  return <KsefSyncHistory connectionId={connectionId} {...history} />;
}
