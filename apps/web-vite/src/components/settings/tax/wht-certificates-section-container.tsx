import { useWhtCertificatesSection } from './hooks/use-wht-certificates-section.js';
import {
  WhtCertificatesSection,
  WhtCertificatesSectionSkeleton,
} from './wht-certificates-section.js';

export function WhtCertificatesSectionContainer() {
  const section = useWhtCertificatesSection();
  if (section.listQuery.isLoading) return <WhtCertificatesSectionSkeleton t={section.t} />;
  return <WhtCertificatesSection {...section} />;
}
