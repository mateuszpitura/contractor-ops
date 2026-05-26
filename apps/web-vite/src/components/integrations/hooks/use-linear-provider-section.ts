import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useLinearProviderSection() {
  const trpc = useTRPC();
  const t = useTranslations('Settings.integrations.linear');
  const [mappingOpen, setMappingOpen] = useState(false);

  const openMappingDialog = useCallback(() => {
    setMappingOpen(true);
  }, []);

  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider: 'linear' }));
  const health = healthQuery.data as { status: string; connectionId?: string } | null | undefined;
  const isConnected = health?.status === 'CONNECTED';
  const isPendingMapping = health?.status === 'PENDING_MAPPING';
  const needsReauth = health?.status === 'REAUTH_REQUIRED';

  useEffect(() => {
    if (isPendingMapping) {
      setMappingOpen(true);
    }
  }, [isPendingMapping]);

  return {
    isConnected,
    isPendingMapping,
    needsReauth,
    mappingOpen,
    setMappingOpen,
    openMappingDialog,
    t,
    isLoading: healthQuery.isLoading,
  } as const;
}
