// Sole tRPC boundary for the read-only 1099-K informational band.
//
// The band state (SAFE / APPROACHING / OVER) is written exclusively by the
// form-1099k-tracker cron; this surface only reads it. There is no mutation —
// the platform never files a 1099-K, so the UI exposes no write path.

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useForm1099kTracker(contractorId: string, taxYear?: number) {
  const trpc = useTRPC();

  const trackerQuery = useQuery({
    ...trpc.form1099kTracker.getTrackerState.queryOptions({
      contractorId,
      ...(taxYear === undefined ? {} : { taxYear }),
    }),
    retry: false,
  });

  return {
    trackerQuery,
    tracker: trackerQuery.data,
    isPending: trackerQuery.isPending,
    isError: trackerQuery.isError,
    refetch: trackerQuery.refetch,
  } as const;
}
