import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';
import { useFlag } from '../../layout/feature-flag-context.js';

export function useClassificationRouteGuard() {
  const trpc = useTRPC();
  const bagQuery = useQuery(trpc.featureFlags.getBag.queryOptions());
  const classificationEnabled = useFlag('module.classification-engine');

  return {
    isPending: bagQuery.isPending,
    classificationEnabled,
  } as const;
}
