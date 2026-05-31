/**
 * Phase 77 D-14/D-16 — sole tRPC boundary for the Slack Org-Grid connection card.
 * Resolves the org-grid OAuth-start URL (connectSlackOrgGrid) and the connection
 * health (reused integration.getHealth for the SLACK provider). The card greys out
 * Connect when the org is not on Enterprise Grid.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSlackOrgGridCard() {
  const trpc = useTRPC();

  const connectQuery = useQuery(trpc.deprovisioning.connectSlackOrgGrid.queryOptions());
  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider: 'slack' }));

  const health = healthQuery.data as
    | { status?: string; scopeCapabilities?: { unavailableReason?: string } | null }
    | null
    | undefined;
  const unavailableReason = health?.scopeCapabilities?.unavailableReason ?? null;
  const notOnEnterpriseGrid = unavailableReason === 'not_on_enterprise_grid';
  const isConnected = health?.status === 'CONNECTED';

  const onConnect = useCallback(() => {
    const url = connectQuery.data?.url;
    if (url) window.location.assign(url);
  }, [connectQuery.data?.url]);

  return {
    isLoading: connectQuery.isLoading || healthQuery.isLoading,
    isError: connectQuery.isError || healthQuery.isError,
    isConnected,
    notOnEnterpriseGrid,
    onConnect,
    connectDisabled: notOnEnterpriseGrid || !connectQuery.data?.url,
  } as const;
}
