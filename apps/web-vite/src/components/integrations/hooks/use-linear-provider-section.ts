import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useIntegrationProviderSection } from './use-integration-provider-section.js';

export function useLinearProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.linear');

  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider: 'linear' }));
  const connection = healthQuery.data as
    | { status: string; connectionId?: string }
    | null
    | undefined;

  const section = useIntegrationProviderSection({
    t,
    connection,
    isLoading: healthQuery.isLoading,
    connectedStatuses: ['CONNECTED'],
    autoOpenMappingOnStatus: 'PENDING_MAPPING',
  });

  useEffect(() => {
    if (section.isPendingMapping) {
      section.setMappingDialogOpen(true);
    }
  }, [section.isPendingMapping, section.setMappingDialogOpen]);

  return {
    ...section,
    mappingOpen: section.mappingDialogOpen,
    setMappingOpen: section.setMappingDialogOpen,
  } as const;
}
