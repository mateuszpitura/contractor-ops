import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type CourierConfig = { carrier: string };

export function useCourierConfigs() {
  const trpc = useTRPC();
  const configsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const configs = (configsQuery.data ?? []) as unknown as CourierConfig[];

  return {
    configsQuery,
    configs,
    isLoading: configsQuery.isLoading,
    isConfigured: (carrier: string) =>
      configs.some(c => c.carrier.toLowerCase() === carrier.toLowerCase()),
  } as const;
}
