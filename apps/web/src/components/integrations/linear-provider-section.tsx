'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { FeatureGate } from '@/components/billing/feature-gate';
import { ProviderConnectionCard } from '@/components/settings/provider-connection-card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';
import { LinearLogo } from './linear-logo';
import { LinearStatusMappingDialog } from './linear-status-mapping-dialog';

// ---------------------------------------------------------------------------
// LinearProviderSection
// ---------------------------------------------------------------------------

export function LinearProviderSection() {
  const t = useTranslations('Settings.integrations.linear');
  const [mappingOpen, setMappingOpen] = useState(false);

  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider: 'linear' }));
  const health = healthQuery.data as { status: string; connectionId?: string } | null | undefined;
  const isConnected = health?.status === 'CONNECTED';
  const isPendingMapping = health?.status === 'PENDING_MAPPING';
  const needsReauth = health?.status === 'REAUTH_REQUIRED';

  // D-03: After OAuth completes, connection status is PENDING_MAPPING.
  // Auto-open the mapping dialog so admin MUST configure at least one team
  // mapping before sync activates. Connection transitions to CONNECTED only
  // after the first successful saveStatusMapping call.
  useEffect(() => {
    if (isPendingMapping) {
      setMappingOpen(true);
    }
  }, [isPendingMapping]);

  return (
    <FeatureGate requiredTier="Pro" featureName="Linear integration">
      <div className="space-y-4">
        <ProviderConnectionCard
          provider="linear"
          displayName="Linear"
          icon={<LinearLogo className="size-8" />}
          description={t('descriptionDisconnected')}
        />

        {isPendingMapping && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('pendingMappingWarning')}
          </div>
        )}

        {(isConnected || isPendingMapping) && (
          <Button variant="outline" size="sm" onClick={() => setMappingOpen(true)}>
            {t('configureMapping')}
          </Button>
        )}

        {needsReauth && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t('scopeExpansionWarning')}
          </div>
        )}

        <LinearStatusMappingDialog open={mappingOpen} onOpenChange={setMappingOpen} />
      </div>
    </FeatureGate>
  );
}
