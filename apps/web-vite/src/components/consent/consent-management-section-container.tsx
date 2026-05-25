import { ConsentManagementSectionView } from './consent-management-section.js';
import { useConsentManagement } from './hooks/use-consent-management.js';

export function ConsentManagementSectionContainer() {
  const consent = useConsentManagement();
  return <ConsentManagementSectionView {...consent} />;
}
