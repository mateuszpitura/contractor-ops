import { useLinearProviderSection } from './hooks/use-linear-provider-section.js';
import {
  LinearProviderSectionSkeleton,
  LinearProviderSectionView,
} from './linear-provider-section.js';

export function LinearProviderSection() {
  const { isLoading, ...rest } = useLinearProviderSection();
  if (isLoading) return <LinearProviderSectionSkeleton />;
  return <LinearProviderSectionView {...rest} />;
}
