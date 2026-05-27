/**
 * Data hook for `overdue-receivables-tile` — UK LPCDA late-interest
 * outstanding accruals. Ported alongside `overdue-receivables-tile.tsx`
 * from legacy apps/web (commit 62a97d73).
 */

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useOverdueReceivablesTile(enabled: boolean) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.latePaymentInterest.getForOrg.queryOptions({ status: 'ACCRUING' }, { enabled }),
  );

  return {
    isLoading: query.isPending,
    data: query.data,
  } as const;
}
