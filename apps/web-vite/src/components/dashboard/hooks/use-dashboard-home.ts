import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDashboardHome(spendMonths: '6' | '12' | 'ytd' = '6') {
  const trpc = useTRPC();
  const bootstrap = useQuery(trpc.dashboard.bootstrap.queryOptions({ spendMonths }));

  return {
    isPending: bootstrap.isPending,
    error: bootstrap.error,
    kpis: bootstrap.data?.kpis,
  } as const;
}
