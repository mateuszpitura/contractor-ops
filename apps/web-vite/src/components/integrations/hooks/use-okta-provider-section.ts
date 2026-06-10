import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDeprovisioningProviderSection } from './use-integration-provider-section.js';

export function useOktaProviderSection() {
  const t = useTranslations('Settings.integrations.okta');
  return useDeprovisioningProviderSection('OKTA', t);
}
