/**
 * Phase 77 D-14 — Slack Org-Grid card container. Decides loading/error vs the
 * card; the hook is the sole tRPC boundary.
 */

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';

import { useSlackOrgGridCard } from './hooks/use-slack-org-grid-card.js';
import { SlackOrgGridCard } from './slack-org-grid-card.js';

export function SlackOrgGridCardContainer() {
  const state = useSlackOrgGridCard();

  if (state.isLoading) {
    return <Skeleton className="h-36 w-full" data-testid="slack-org-grid-skeleton" />;
  }

  return (
    <SlackOrgGridCard
      isConnected={state.isConnected}
      notOnEnterpriseGrid={state.notOnEnterpriseGrid}
      connectDisabled={state.connectDisabled}
      onConnect={state.onConnect}
    />
  );
}
