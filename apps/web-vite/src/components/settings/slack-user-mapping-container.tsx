import { useSlackUserMapping } from './hooks/use-slack-user-mapping.js';
import { SlackUserMapping, SlackUserMappingSkeleton } from './slack-user-mapping.js';

export function SlackUserMappingContainer() {
  const mapping = useSlackUserMapping();
  if (mapping.isLoading) return <SlackUserMappingSkeleton />;
  return <SlackUserMapping {...mapping} />;
}
