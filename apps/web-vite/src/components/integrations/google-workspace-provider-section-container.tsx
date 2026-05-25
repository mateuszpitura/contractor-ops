import {
  GoogleWorkspaceProviderSectionSkeleton,
  GoogleWorkspaceProviderSectionView,
} from './google-workspace-provider-section.js';
import { useGoogleWorkspaceProviderSection } from './hooks/use-google-workspace-provider-section.js';

export function GoogleWorkspaceProviderSection() {
  const { isLoading, ...rest } = useGoogleWorkspaceProviderSection();
  if (isLoading) return <GoogleWorkspaceProviderSectionSkeleton />;
  return <GoogleWorkspaceProviderSectionView {...rest} />;
}
