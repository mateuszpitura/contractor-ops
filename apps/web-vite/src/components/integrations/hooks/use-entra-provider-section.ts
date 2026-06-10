import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDeprovisioningProviderSection } from './use-integration-provider-section.js';

export function useEntraProviderSection() {
  const t = useTranslations('Settings.integrations.entra');
  return useDeprovisioningProviderSection('ENTRA', t);
}
