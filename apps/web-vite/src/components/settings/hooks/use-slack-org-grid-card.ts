/**
 * Sole tRPC boundary for the Slack Org-Grid connection card. Resolves the
 * org-grid OAuth-start URL (connectSlackOrgGrid), the connection state from
 * getProviderToggleState (which checks connectionSubKind === 'SLACK_ORG_GRID' —
 * mirrors deprovisioning.ts:590-596), and the Enterprise-Grid availability
 * signal from integration.getHealth (scopeCapabilities.unavailableReason).
 *
 * Two separate probes are intentional:
 *   - `isConnected` ← getProviderToggleState SLACK row `.connected` (org-grid
 *     sub-kind, the deprovision token). This is the correct gate;
 *     `integration.getHealth` reports the WORKSPACE bot token and must NOT be
 *     used for connected-state here.
 *   - `notOnEnterpriseGrid` ← integration.getHealth scopeCapabilities (the only
 *     endpoint that probes Grid availability; unavailableReason is set by the
 *     workspace-level health probe and does not require an org-grid connection).
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSlackOrgGridCard() {
  const trpc = useTRPC();

  const connectQuery = useQuery(trpc.deprovisioning.connectSlackOrgGrid.queryOptions());
  const toggleStateQuery = useQuery(trpc.deprovisioning.getProviderToggleState.queryOptions());
  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider: 'slack' }));

  // Connected = SLACK_ORG_GRID sub-kind connection exists (not the workspace bot token).
  const slackRow = toggleStateQuery.data?.providers.find(p => p.provider === 'SLACK');
  const isConnected = slackRow?.connected === true;

  // Enterprise Grid detection comes from the workspace health probe.
  const health = healthQuery.data as
    | { scopeCapabilities?: { unavailableReason?: string } | null }
    | null
    | undefined;
  const notOnEnterpriseGrid =
    health?.scopeCapabilities?.unavailableReason === 'not_on_enterprise_grid';

  const onConnect = useCallback(() => {
    const url = connectQuery.data?.url;
    if (url) window.location.assign(url);
  }, [connectQuery.data?.url]);

  return {
    isLoading: connectQuery.isLoading || toggleStateQuery.isLoading || healthQuery.isLoading,
    isError: connectQuery.isError || toggleStateQuery.isError || healthQuery.isError,
    isConnected,
    notOnEnterpriseGrid,
    onConnect,
    connectDisabled: notOnEnterpriseGrid || !connectQuery.data?.url,
  } as const;
}
