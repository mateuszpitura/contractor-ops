import { useJiraProviderSection } from './hooks/use-jira-provider-section.js';
import { JiraProviderSectionSkeleton, JiraProviderSectionView } from './jira-provider-section.js';

export function JiraProviderSection() {
  const { isLoading, ...rest } = useJiraProviderSection();
  if (isLoading) return <JiraProviderSectionSkeleton />;
  return <JiraProviderSectionView {...rest} />;
}
