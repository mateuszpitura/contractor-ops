import { useUpsProviderSection } from './hooks/use-ups-provider-section.js';
import { UpsProviderSection, UpsProviderSectionSkeleton } from './ups-provider-section.js';

export function UpsProviderSectionContainer() {
  const section = useUpsProviderSection();
  if (section.isLoading) return <UpsProviderSectionSkeleton />;
  return <UpsProviderSection {...section} />;
}
