import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

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

  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: 'microsoft_teams' }),
  );
  const health = healthQuery.data as { status: string; connectionId?: string } | null | undefined;

  const connectionStatusQuery = useQuery(trpc.teams.connectionStatus.queryOptions());
  const connectionStatus = connectionStatusQuery.data as
    | { id: string; status: string; configJson: Record<string, unknown> | null }
    | null
    | undefined;

  const isConnected = health?.status === 'CONNECTED' || connectionStatus?.status === 'CONNECTED';

  const configJson = (connectionStatus?.configJson ?? {}) as TeamsConfigJson;
  const defaultTeamId = configJson.defaultTeamId;
  const defaultFallbackApproverId = configJson.defaultFallbackApproverId ?? null;

  return {
    isConnected,
    defaultTeamId,
    defaultFallbackApproverId,
    fallbackOpen,
    setFallbackOpen,
    handleOpenFallback,
    t,
    tFb,
    isLoading: healthQuery.isLoading || connectionStatusQuery.isLoading,
  } as const;
}
