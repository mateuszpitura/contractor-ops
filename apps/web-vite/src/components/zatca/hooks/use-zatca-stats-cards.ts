import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ComplianceStats } from '../zatca-trpc.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useZatcaStatsCards() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.statsCards');

  const statsQuery = useQuery(
    zatcaTrpc.getComplianceStats.queryOptions(undefined, { refetchInterval: 30_000 }),
  );

  const stats = statsQuery.data as ComplianceStats | undefined;
  const total = stats?.total ?? 0;
  const successful = (stats?.cleared ?? 0) + (stats?.reported ?? 0);
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 100;
  const pending = stats?.pending ?? 0;
  const rejected = stats?.rejected ?? 0;

  return {
    isLoading: statsQuery.isLoading,
    successRate,
    pending,
    rejected,
    successful,
    total,
    t,
  } as const;
}
