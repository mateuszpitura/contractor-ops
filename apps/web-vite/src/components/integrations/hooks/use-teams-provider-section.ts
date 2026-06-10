import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useIntegrationHealthProviderSection } from './use-integration-provider-section.js';

export interface TeamsConfigJson {
  defaultTeamId?: string;
  defaultFallbackApproverId?: string | null;
  [key: string]: unknown;
}

export function useTeamsProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.teams');
  const tFb = useTranslations('Settings.integrations.teams.fallbackApprover');
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const handleOpenFallback = useCallback(() => setFallbackOpen(true), []);

  const section = useIntegrationHealthProviderSection('microsoft_teams', t);

  const connectionStatusQuery = useQuery(trpc.teams.connectionStatus.queryOptions());
  const connectionStatus = connectionStatusQuery.data;

  const isConnected = section.isConnected && !section.needsReauth;

  const configJson = (connectionStatus?.configJson ?? {}) as TeamsConfigJson;
  const defaultTeamId = configJson.defaultTeamId;
  const defaultFallbackApproverId = configJson.defaultFallbackApproverId ?? null;

  const onRetry = useCallback(() => {
    section.onRetry();
    void connectionStatusQuery.refetch();
  }, [section, connectionStatusQuery]);

  return {
    isConnected,
    needsReauth: section.needsReauth,
    defaultTeamId,
    defaultFallbackApproverId,
    fallbackOpen,
    setFallbackOpen,
    handleOpenFallback,
    t,
    tFb,
    isLoading: section.isLoading || connectionStatusQuery.isLoading,
    isError: section.isError || connectionStatusQuery.isError,
    onRetry,
  } as const;
}
