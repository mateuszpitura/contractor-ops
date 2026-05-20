'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { FeatureGate } from '@/components/billing/feature-gate';
import { ProviderConnectionCard } from '@/components/settings/provider-connection-card';
import { trpc } from '@/trpc/init';
import { JiraLogo } from './jira-logo';
import { JiraStatusMappingDialog } from './jira-status-mapping-dialog';

// ---------------------------------------------------------------------------
// JiraProviderSection
// ---------------------------------------------------------------------------

export function JiraProviderSection() {
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const t = useTranslations('Integrations');

  const openMappingDialog = useCallback(() => {
    setMappingDialogOpen(true);
  }, []);

  const connectionQuery = useQuery(trpc.jira.connectionStatus.queryOptions());
  const connection = connectionQuery.data as
    | {
        id: string;
        status: string;
        scopeExpansionNeeded?: boolean;
        configJson?: Record<string, unknown>;
      }
    | null
    | undefined;
  const isConnected = connection?.status === 'CONNECTED';

  return (
    <FeatureGate requiredTier="Pro" featureName="Jira integration">
      <div className="flex h-full flex-col gap-4">
        <ProviderConnectionCard
          provider="jira"
          displayName="Jira"
          icon={<JiraLogo className="size-8" />}
          description={t('jiraProvider.description')}
        />

        {!!isConnected && !!connection?.scopeExpansionNeeded && (
          <div className="flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
            <AlertTriangle className="size-4 text-warning" />
            <span className="text-sm text-warning">{t('jiraProvider.scopeWarning')}</span>
          </div>
        )}

        {isConnected && !connection?.scopeExpansionNeeded && (
          <Button variant="outline" size="sm" onClick={openMappingDialog}>
            {t('jiraProvider.configureStatusMapping')}
          </Button>
        )}

        {!!mappingDialogOpen && !!connection && (
          <JiraStatusMappingDialog
            open={mappingDialogOpen}
            onOpenChange={setMappingDialogOpen}
            connectionId={connection.id}
          />
        )}
      </div>
    </FeatureGate>
  );
}
