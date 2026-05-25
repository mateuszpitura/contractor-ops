import { useSkontoBanner } from '../hooks/use-skonto-banner.js';
import { SkontoBanner, SkontoBannerSkeleton } from './skonto-banner.js';

interface SkontoBannerContainerProps {
  invoiceId: string;
  featureEnabled: boolean;
}

export function SkontoBannerContainer({ invoiceId, featureEnabled }: SkontoBannerContainerProps) {
  const { isLoading, data } = useSkontoBanner(invoiceId, featureEnabled);

  if (!featureEnabled) return null;
  if (isLoading) return <SkontoBannerSkeleton />;
  if (!data) return null;
  if (data.eligibilityReason === 'NO_SKONTO_CONFIGURED') return null;

  return <SkontoBanner data={data} />;
}
