/**
 * Sole tRPC boundary for the impact-preview panel.
 * Queries describeImpact for a (provider, assignment); refresh() re-queries with
 * forceRefresh; exposes the structured failure for the admin-choice flow.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type ImpactProvider = 'GOOGLE_WORKSPACE' | 'SLACK';

export function useImpactPreview(assignmentId: string, provider: ImpactProvider) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const query = useQuery(
    trpc.deprovisioning.describeImpact.queryOptions({ assignmentId, provider }),
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.deprovisioning.describeImpact.queryKey({ assignmentId, provider }),
    });
    // Force a server-side cache bypass on the refetch.
    await queryClient.fetchQuery(
      trpc.deprovisioning.describeImpact.queryOptions({
        assignmentId,
        provider,
        forceRefresh: true,
      }),
    );
    setLastRefreshedAt(new Date());
  }, [queryClient, trpc, assignmentId, provider]);

  const result = query.data;
  return {
    isLoading: query.isLoading,
    isError: query.isError,
    onRetry: () => query.refetch(),
    preview: result?.ok ? result.preview : null,
    failure: result && !result.ok ? result : null,
    refresh,
    lastRefreshedAt,
  } as const;
}
