import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useIntegrationProviderSection } from './use-integration-provider-section.js';

export function useJiraProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Integrations');

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

  return useIntegrationProviderSection({
    t,
    connection,
    isLoading: connectionQuery.isLoading,
    connectedStatuses: ['CONNECTED'],
  });
}
