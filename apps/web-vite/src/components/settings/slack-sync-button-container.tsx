import { useSlackSyncButton } from './hooks/use-slack-sync-button.js';
import { SlackSyncButton } from './slack-sync-button.js';

// Decision: mutation host — button mounted by SlackUserMapping; hook exposes the sync
// mutation handler + isPending consumed inline by the button view.
export function SlackSyncButtonContainer() {
  const sync = useSlackSyncButton();
  return <SlackSyncButton {...sync} />;
}
