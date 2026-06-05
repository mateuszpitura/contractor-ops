/**
 * Data hook for the dashboard spend chart — monthly spend totals per
 * currency, parameterised by a `?spend=6|12|ytd` URL state. Split out so
 * the widget itself stays free of useQuery (enforced by
 * `scripts/check-web-vite-data-layer.mjs`).
 */

import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type SpendRange = '6' | '12' | 'ytd';

export function useSpendChart() {
  const trpc = useTRPC();
  const [spendRange, setSpendRange] = useQueryState('spend', parseAsString.withDefault('6'));
  const query = useQuery(
    trpc.dashboard.spendTrend.queryOptions({
      months: spendRange as SpendRange,
    }),
  );

  return {
    isLoading: query.isPending,
    rows: query.data ?? [],
    spendRange: spendRange as SpendRange,
    setSpendRange: (value: SpendRange) => setSpendRange(value),
  } as const;
}
