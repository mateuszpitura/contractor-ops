import {
  ConsentManagementSectionLoading,
  ConsentManagementSectionNotRequired,
  ConsentManagementSectionView,
} from './consent-management-section.js';
import { useConsentManagement } from './hooks/use-consent-management.js';

export function ConsentManagementSectionContainer() {
  const consent = useConsentManagement();

  if (consent.isLoading) return <ConsentManagementSectionLoading />;
  if (consent.showNotRequired) return <ConsentManagementSectionNotRequired />;

  return <ConsentManagementSectionView {...consent} />;
}
