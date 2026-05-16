'use client';

import { useQuery } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { FeatureGate } from '@/components/billing/feature-gate';
import { ProviderConnectionCard } from '@/components/settings/provider-connection-card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';
import { TeamsBrandIcon } from './brand-icons';
import { TeamsChannelMappingCard } from './teams-channel-mapping-card';
import { TeamsFallbackApproverDialog } from './teams-fallback-approver-dialog';

// ---------------------------------------------------------------------------
// TeamsProviderSection
// ---------------------------------------------------------------------------

interface TeamsConfigJson {
  /**
   * Optional default organisational `Team` id used by the fallback-approver
   * picker. Currently surfaced by Phase 74 settings flows; falls back to
   * undefined when not configured.
   */
  defaultTeamId?: string;
  defaultFallbackApproverId?: string | null;
  [key: string]: unknown;
}

export function TeamsProviderSection() {
  const t = useTranslations('Settings.integrations.teams');
  const tFb = useTranslations('Settings.integrations.teams.fallbackApprover');
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: 'microsoft_teams' }),
  );
  const health = healthQuery.data as { status: string; connectionId?: string } | null | undefined;

  // teams.connectionStatus complements `integration.getHealth`: it exposes
  // the raw configJson (channel mapping, optional defaultTeamId for
  // fallback-approver) which getHealth omits.
  const connectionStatusQuery = useQuery(trpc.teams.connectionStatus.queryOptions());
  const connectionStatus = connectionStatusQuery.data as
    | { id: string; status: string; configJson: Record<string, unknown> | null }
    | null
    | undefined;

  const isConnected = health?.status === 'CONNECTED' || connectionStatus?.status === 'CONNECTED';

  const configJson = (connectionStatus?.configJson ?? {}) as TeamsConfigJson;
  const defaultTeamId = configJson.defaultTeamId;
  const defaultFallbackApproverId = configJson.defaultFallbackApproverId ?? null;

  const handleOpenFallback = useCallback(() => setFallbackOpen(true), []);

  return (
    <FeatureGate requiredTier="Pro" featureName="Microsoft Teams integration">
      <div className="flex h-full flex-col gap-4">
        <ProviderConnectionCard
          provider="microsoft_teams"
          displayName="Microsoft Teams"
          icon={<TeamsBrandIcon className="size-8" />}
          description={isConnected ? t('descriptionConnected') : t('descriptionDisconnected')}
        />

        {!!isConnected && <TeamsChannelMappingCard />}

        {/*
          Fallback approver — wires teams.setFallbackApprover for the Phase 74
          offboarding fallback chain. Surfaces only once an org `Team`
          (organisational unit) is exposed via configJson.defaultTeamId,
          which Phase 74 settings populates.
        */}
        {!!isConnected && !!defaultTeamId && (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{tFb('cardTitle')}</p>
              <p className="text-xs text-muted-foreground">{tFb('cardBody')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenFallback}>
              <UserCog className="me-2 size-4" />
              {tFb('configureCta')}
            </Button>
          </div>
        )}

        {!!defaultTeamId && (
          <TeamsFallbackApproverDialog
            teamId={defaultTeamId}
            currentFallbackApproverId={defaultFallbackApproverId}
            open={fallbackOpen}
            onOpenChange={setFallbackOpen}
          />
        )}
      </div>
    </FeatureGate>
  );
}
