import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useJiraProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Integrations');
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

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

  return {
    connection,
    isConnected,
    mappingDialogOpen,
    setMappingDialogOpen,
    openMappingDialog,
    t,
    isLoading: connectionQuery.isLoading,
  } as const;
}
