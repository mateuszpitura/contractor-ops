// Decision: button widget mounted by SlackUserMapping parent. Container scopes the sync
// mutation hook lifecycle; view renders the button with pending state.
import { useSlackSyncButton } from './hooks/use-slack-sync-button.js';
import { SlackSyncButton } from './slack-sync-button.js';

export function SlackSyncButtonContainer() {
  const sync = useSlackSyncButton();
  return <SlackSyncButton {...sync} />;
}
