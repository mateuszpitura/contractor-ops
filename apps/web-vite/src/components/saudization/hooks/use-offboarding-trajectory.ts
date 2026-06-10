import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type OffboardingTrajectory = RouterOutputs['gulf']['saudization']['offboardingTrajectory'];

/**
 * Read-only tRPC boundary for the offboarding band-trajectory. The projection
 * is ephemeral, advisory, non-authoritative, and never gates — this hook only
 * reads it. The Saudi-national flag sharpens the projected rate; the server
 * never asserts a projected band.
 */
export function useOffboardingTrajectory(offboardingContractorIsSaudi: boolean | null) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.gulf.saudization.offboardingTrajectory.queryOptions({ offboardingContractorIsSaudi }),
  );

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    data: query.data ?? null,
  } as const;
}
