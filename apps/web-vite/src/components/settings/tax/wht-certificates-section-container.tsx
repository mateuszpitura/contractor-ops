// Decision: tax section mounted by SettingsTaxContainer (already gates `canView` permission via
// Navigate). Hook owns certificates list query + upload mutation; view renders the table +
// upload action. Container is the hook ownership boundary.
import { useWhtCertificatesSection } from './hooks/use-wht-certificates-section.js';
import { WhtCertificatesSection } from './wht-certificates-section.js';

export function WhtCertificatesSectionContainer() {
  const section = useWhtCertificatesSection();
  return <WhtCertificatesSection {...section} />;
}
