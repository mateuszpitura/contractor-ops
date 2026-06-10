import type { ScopeCapabilities } from '@contractor-ops/validators/scope-capabilities';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useIntegrationHealthProviderSection } from './use-integration-provider-section.js';

export function useGoogleWorkspaceProviderSection() {
  const t = useTranslations('Settings.integrations.googleWorkspace');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('google_workspace') !== 'connected') return;
    setWizardOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('google_workspace');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const onImportClick = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const section = useIntegrationHealthProviderSection('google_workspace', t);
  const scopeCapabilities: ScopeCapabilities | null = section.scopeCapabilities;

  return {
    isConnected: section.isConnected,
    needsReauth: section.needsReauth,
    wizardOpen,
    setWizardOpen,
    onImportClick,
    t: section.t,
    scopeCapabilities,
    isLoading: section.isLoading,
    isError: section.isError,
    onRetry: section.onRetry,
  } as const;
}
