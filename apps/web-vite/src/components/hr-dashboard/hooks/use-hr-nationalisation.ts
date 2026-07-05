import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Per-country nationalisation rollup — KSA Saudization + UAE Emiratisation (HR-DASH-05). */
export type HrNationalisation = RouterOutputs['hrDashboard']['getNationalisationRollup'];
export type NationalisationRollup = NonNullable<HrNationalisation['ksa']>;

/**
 * Sole tRPC boundary for the HR-DASH-05 Gulf nationalisation section. Reads the
 * per-country rollup where a country is present ONLY when its manual headcount
 * exists — a missing country carries no platform-derived rate, so the view shows
 * the "record manual headcount" prompt (the F3 anti-feature upheld at the
 * presentation layer). Returns a props bag + variant flags; the wired section
 * owns loading / error. The section always renders both country columns (rollup
 * or prompt), so `isEmpty` is informational only.
 */
export function useHrNationalisation() {
  const trpc = useTRPC();
  const query = useQuery(trpc.hrDashboard.getNationalisationRollup.queryOptions({}));

  const data = query.data;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    isEmpty: data !== undefined && !data.ksa && !data.uae,
    onRetry: () => void query.refetch(),
    ksa: data?.ksa,
    uae: data?.uae,
  } as const;
}
