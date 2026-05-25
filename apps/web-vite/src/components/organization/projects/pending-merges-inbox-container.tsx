import { usePendingMergesInbox } from '../hooks/use-pending-merges-inbox.js';
import { PendingMergesInbox } from './pending-merges-inbox.js';

export function PendingMergesInboxContainer() {
  const inbox = usePendingMergesInbox();
  if (inbox.items.length === 0) return null;
  return <PendingMergesInbox inbox={inbox} />;
}
