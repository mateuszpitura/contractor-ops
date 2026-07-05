import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Section-filtered employee document-expiry read model (HR-DASH-03). */
export type HrDocExpiry = RouterOutputs['hrDashboard']['getDocumentExpiry'];
export type DocExpiryItem = HrDocExpiry['items'][number];

/**
 * Sole tRPC boundary for the HR-DASH-03 document-expiry section. The server has
 * already filtered every row to the sections the caller may read (payroll_officer
 * sees only its section, etc.) — the UI renders ONLY what it receives and never
 * reconstructs a full section set. Returns a props bag + variant flags; the wired
 * section owns loading / empty (no readable expiry docs) / error.
 */
export function useHrDocExpiry() {
  const trpc = useTRPC();
  const query = useQuery(trpc.hrDashboard.getDocumentExpiry.queryOptions({}));

  const data = query.data;
  const items = data?.items ?? [];

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    isEmpty: data !== undefined && items.length === 0,
    onRetry: () => void query.refetch(),
    items,
    byBand: data?.byBand ?? { expired: 0, soon30: 0, soon60: 0, soon90: 0, later: 0 },
    byCategory: data?.byCategory ?? {},
  } as const;
}
