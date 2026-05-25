// Decision: integrations sub-section mounted by IntegrationsTab (gated upstream by
// canManageIntegrations). View internally branches on isLoading + per-row sync state.
import { useSlackUserMapping } from './hooks/use-slack-user-mapping.js';
import { SlackUserMapping } from './slack-user-mapping.js';

export function SlackUserMappingContainer() {
  const mapping = useSlackUserMapping();
  return <SlackUserMapping {...mapping} />;
}
