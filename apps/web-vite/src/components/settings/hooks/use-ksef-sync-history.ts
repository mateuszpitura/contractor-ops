import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface SyncLogEntry {
  id: string;
  syncType: string;
  status: string;
  direction: string;
  errorMessage: string | null;
  responsePayloadJson: Record<string, unknown> | null;
  startedAt: string | Date;
  completedAt: string | Date | null;
}

export function useKsefSyncHistory(connectionId: string | undefined) {
  const trpc = useTRPC();
  const t = useTranslations('ksef');
  const [isOpen, setIsOpen] = useState(false);

  const syncHistoryQuery = useQuery(
    trpc.ksef.syncHistory.queryOptions({ limit: 10 }, { enabled: !!connectionId }),
  );

  const rawData = syncHistoryQuery.data as { logs: SyncLogEntry[] } | undefined;
  const logs = rawData?.logs ?? [];

  return {
    t,
    isOpen,
    setIsOpen,
    syncHistoryQuery,
    logs,
    isLoading: syncHistoryQuery.isLoading,
  } as const;
}
