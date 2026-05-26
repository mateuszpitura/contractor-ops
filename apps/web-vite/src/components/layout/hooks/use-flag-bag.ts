import type { FlagValues } from '@contractor-ops/feature-flags/browser';
import { emptyFlagBag } from '@contractor-ops/feature-flags/browser';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useFlagBagValues(
  activeOrgId: string | null | undefined,
  isSessionPending: boolean,
): FlagValues {
  const trpc = useTRPC();
  const enabled = Boolean(activeOrgId) && !isSessionPending;

  const bagQuery = useQuery({
    ...trpc.featureFlags.getBag.queryOptions(),
    enabled,
  });

  return useMemo(() => {
    if (enabled && bagQuery.data) {
      return bagQuery.data;
    }
    return emptyFlagBag().values;
  }, [enabled, bagQuery.data]);
}
