import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDeprovisioningProviderSection } from './use-integration-provider-section.js';

export function useGitHubProviderSection() {
  const t = useTranslations('Settings.integrations.github');
  return useDeprovisioningProviderSection('GITHUB', t);
}
