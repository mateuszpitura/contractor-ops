import { DpdProviderSection, DpdProviderSectionSkeleton } from './dpd-provider-section.js';
import { useDpdProviderSection } from './hooks/use-dpd-provider-section.js';

export function DpdProviderSectionContainer() {
  const section = useDpdProviderSection();
  if (section.isLoading) return <DpdProviderSectionSkeleton />;
  return <DpdProviderSection {...section} />;
}
