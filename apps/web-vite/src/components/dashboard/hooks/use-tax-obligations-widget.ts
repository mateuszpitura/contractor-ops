/**
 * Data hook for the dashboard tax-obligations widget — VAT + WHT summary
 * for the current reporting period. Ported alongside
 * `tax-obligations-widget.tsx` from legacy apps/web (commit 62a97d73).
 */

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useTaxObligationsWidget() {
  const trpc = useTRPC();
  const query = useQuery(trpc.tax.taxSummary.queryOptions());

  return {
    isLoading: query.isPending,
    isError: query.isError,
    onRetry: () => query.refetch(),
    data: query.data ?? null,
  } as const;
}
