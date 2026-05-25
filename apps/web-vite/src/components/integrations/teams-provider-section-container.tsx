import { useTeamsProviderSection } from './hooks/use-teams-provider-section.js';
import {
  TeamsProviderSectionSkeleton,
  TeamsProviderSectionView,
} from './teams-provider-section.js';

export function TeamsProviderSection() {
  const { isLoading, ...rest } = useTeamsProviderSection();
  if (isLoading) return <TeamsProviderSectionSkeleton />;
  return <TeamsProviderSectionView {...rest} />;
}
