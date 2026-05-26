import type { ScopeCapabilities } from '@contractor-ops/db';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useGoogleWorkspaceProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.googleWorkspace');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('google_workspace') === 'connected') {
      setWizardOpen(true);
    }
  }, [searchParams]);

  const onImportClick = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: 'google_workspace' }),
  );
  const health = healthQuery.data as { status: string; connectionId?: string } | null | undefined;
  const isConnected = health?.status === 'CONNECTED';

  const scopeCapabilities: ScopeCapabilities | null = null;

  return {
    isConnected,
    wizardOpen,
    setWizardOpen,
    onImportClick,
    t,
    scopeCapabilities,
    isLoading: healthQuery.isLoading,
  } as const;
}
